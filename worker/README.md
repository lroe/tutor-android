# Cove Worker

A tiny Cloudflare Worker that lets the Cove PWA call **OpenCode Go** without
putting the Go key in the browser.

It does three things:

1. Accepts `POST /v1/chat/completions` from Cove.
2. Adds your `OPENCODE_API_KEY`, a user agent, and a session header, then
   forwards the request to OpenCode Go.
3. Adds CORS headers and streams the reply back.

There is no database and nothing to maintain after deploy.

---

## What you need

- A free Cloudflare account.
- An OpenCode Go subscription and API key from
  https://opencode.ai/console.

---

## Option A: deploy from the dashboard (no CLI)

1. **Copy the Go key.**
   Open https://opencode.ai/console, find the API keys section, and create or
   copy a key.

   In **Settings → Privacy → Regions**, enable **Global** for DeepSeek V4.1
   Flash. Without that, OpenCode Go can reject the model with a region error.

2. **Create the Worker.**
   Cloudflare dashboard → **Workers & Pages** → **Create** → **Worker**.
   Name it `cove-proxy`, then **Deploy**.

3. **Paste the code.**
   Click **Edit code**, replace the starter code with
   [index.js](index.js), then **Deploy**.

4. **Add the key.**
   Worker → **Settings** → **Variables and Secrets** → **Add**:
   - Name: `OPENCODE_API_KEY`
   - Type: **Secret**
   - Value: your Go key

   Add these optional variables:
   - `ALLOWED_ORIGIN` — **Text**, comma-separated sites allowed to call the
     Worker. Example:
     `https://your-site.netlify.app,http://localhost:5173`
     Leave it unset for `*` while testing.
   - `ALLOWED_MODELS` — **Text**, default `deepseek-v4.1-flash`. Add more models
     comma-separated if you change the app.

5. **Copy the URL.**
   It looks like `https://cove-proxy.your-subdomain.workers.dev`.

6. **Check it.**
   Open `https://cove-proxy.your-subdomain.workers.dev/health` in a browser.
   You should see:

   ```json
   {"ok":true,"service":"cove-proxy","models":["deepseek-v4.1-flash"]}
   ```

7. **Connect Cove.**
   Open Cove → gear → **Worker URL** → paste the URL → **Test connection** →
   **Save**.

---

## Option B: deploy with Wrangler

Requires Node.js 20.19+.

```bash
cd worker
npx wrangler@latest login
npx wrangler@latest deploy
npx wrangler@latest secret put OPENCODE_API_KEY
```

Paste the Go key when asked. Then open the `/health` URL to confirm.

To lock down the origin, uncomment `ALLOWED_ORIGIN` in `wrangler.toml`, set your
site, and run `npx wrangler@latest deploy` again. Or set it in the dashboard.

`ALLOWED_MODELS` is already in `wrangler.toml`.

---

## Pre-fill the Worker URL in Cove

At runtime: paste it in Settings.

At build time, create `.env.local` in the project root:

```bash
VITE_COVE_PROXY_URL=https://cove-proxy.your-subdomain.workers.dev
```

Then run `npm run build`. The Settings field will be prefilled, and the user can
still change it.

---

## Endpoints

| Request | What it does |
| --- | --- |
| `GET /health` | Returns `{ok:true,...}`. Used by **Test connection**. |
| `POST /v1/chat/completions` | Forwards an OpenAI-compatible chat request to OpenCode Go. |
| `OPTIONS *` | CORS preflight. |

The request must include:

- `x-cove-model: deepseek-v4.1-flash`
- `x-opencode-session: <stable conversation id>`
- `Content-Type: application/json`

The body is forwarded unchanged. The Worker checks the model header against
`ALLOWED_MODELS`.

---

## Troubleshooting

**Cove says "Couldn't reach the Cove Worker."**
- Check the URL in Settings. It should be the root, not `/v1/chat/completions`
  (both work, but the root is simpler).
- Open `<url>/health` in a browser.
- If `ALLOWED_ORIGIN` is set, make sure it contains the exact site origin,
  including scheme and port: `http://localhost:5173` or
  `https://your-site.netlify.app`.

**HTTP 401 or 403 from the model.**
- `OPENCODE_API_KEY` is missing, wrong, or expired.
- The Go subscription is inactive.
- Update the secret in the Worker settings.

**HTTP 400, "Model not allowed."**
- The app's model and `ALLOWED_MODELS` do not match.
- Set `ALLOWED_MODELS` to `deepseek-v4.1-flash`, or change the model in
  `src/lib/models.ts`.

**HTTP 429.**
- The Go plan's rate limit or monthly allowance is reached.
- Wait, or use the Gemini provider.

**Figure crops or OCR look wrong.**
- That is the model's vision, not the Worker. Switch to Gemini in Cove's
  Settings and try the same page.

**Streaming arrives all at once.**
- Check that no proxy or CDN in front of the Worker is buffering
  `text/event-stream`. Cloudflare passes it through by default.

---

## Security and limits

- The Go key is stored as an encrypted Worker secret. It is never sent to the
  browser.
- The Worker URL is effectively a capability. Anyone who has it can spend your
  Go allowance. Set `ALLOWED_ORIGIN`, keep the URL private, and do not publish a
  shared proxy.
- Cloudflare Workers Free: 100,000 requests/day and 10 ms CPU per request. This
  Worker only forwards bytes, so it stays well inside that. A lesson is roughly
  10–20 requests.
- OpenCode Go is intended for coding agents. Cove sends tutoring traffic through
  it. That is fine for personal use, but outside the stated purpose. Do not turn
  it into a public service.
- Rotate the Go key in the OpenCode Console, then update
  `OPENCODE_API_KEY` in the Worker. No app rebuild is needed.
