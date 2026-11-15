const UPSTREAM =
  "https://opencode.ai/inference/go/openai/v1/chat/completions";

function corsHeaders(env, request) {
  const configured = (env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const origin = request.headers.get("Origin") || "";

  let allow = "*";
  if (configured.length && !configured.includes("*")) {
    if (origin && configured.includes(origin)) {
      allow = origin;
    } else if (!origin) {
      allow = configured[0];
    } else {
      return null;
    }
  }

  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "content-type, x-cove-model, x-opencode-session",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env, request);
    if (!cors) {
      return new Response("Origin not allowed.", { status: 403 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (
      request.method === "GET" &&
      (url.pathname === "/" || url.pathname === "/health")
    ) {
      return json(
        {
          ok: true,
          service: "cove-proxy",
          models: (env.ALLOWED_MODELS || "deepseek-v4.1-flash")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        },
        200,
        cors,
      );
    }

    if (
      request.method !== "POST" ||
      (url.pathname !== "/" && url.pathname !== "/v1/chat/completions")
    ) {
      return json(
        { error: { message: "Not found." } },
        404,
        cors,
      );
    }

    if (!env.OPENCODE_API_KEY) {
      return json(
        {
          error: {
            message:
              "OPENCODE_API_KEY is not set on this Worker. Add it in Settings → Variables and Secrets.",
          },
        },
        500,
        cors,
      );
    }

    const allowedModels = (env.ALLOWED_MODELS || "deepseek-v4.1-flash")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const model = request.headers.get("x-cove-model") || "";
    if (!allowedModels.includes(model)) {
      return json(
        {
          error: {
            message: `Model not allowed. Use one of: ${allowedModels.join(", ")}.`,
          },
        },
        400,
        cors,
      );
    }

    const session =
      request.headers.get("x-opencode-session") || crypto.randomUUID();

    let upstream;
    try {
      upstream = await fetch(UPSTREAM, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENCODE_API_KEY}`,
          "User-Agent": "cove-proxy/1.0",
          "x-opencode-session": session,
        },
        body: request.body,
      });
    } catch {
      return json(
        {
          error: {
            message: "Couldn't reach OpenCode Go from the Worker.",
          },
        },
        502,
        cors,
      );
    }

    const headers = new Headers(cors);
    const contentType = upstream.headers.get("content-type");
    if (contentType) headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "no-store");

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  },
};
