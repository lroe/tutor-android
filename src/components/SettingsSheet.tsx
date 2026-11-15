import { useState } from "react";
import { Sheet } from "./Sheet";
import { GEMINI_MODEL, OPENCODE_MODEL } from "../lib/models";
import { testProxy } from "../lib/opencode";
import { describeAIError } from "../lib/gemini";
import type { AIProvider, Settings } from "../lib/types";

export function SettingsSheet({
  settings,
  onClose,
  onSave,
}: {
  settings: Settings;
  onClose: () => void;
  onSave: (patch: Partial<Settings>) => void;
}) {
  const [provider, setProvider] = useState<AIProvider>(settings.provider);
  const [proxyUrl, setProxyUrl] = useState(settings.proxyUrl);
  const [geminiKey, setGeminiKey] = useState("");
  const [testState, setTestState] = useState<
    "idle" | "testing" | "ok" | "error"
  >("idle");
  const [testMessage, setTestMessage] = useState("");

  const effectiveGeminiKey = geminiKey.trim() || settings.geminiKey;
  const validProxy = /^https?:\/\//i.test(proxyUrl.trim());
  const canSave =
    provider === "gemini"
      ? Boolean(effectiveGeminiKey)
      : validProxy;

  const switchProvider = (next: AIProvider) => {
    setProvider(next);
    setTestState("idle");
    setTestMessage("");
  };

  const runTest = async () => {
    const url = proxyUrl.trim();
    if (!url) return;
    setTestState("testing");
    setTestMessage("");
    try {
      await testProxy(url);
      setTestState("ok");
      setTestMessage("Worker is reachable.");
    } catch (error) {
      setTestState("error");
      setTestMessage(describeAIError(error));
    }
  };

  const save = () => {
    const patch: Partial<Settings> = { provider };
    if (proxyUrl.trim()) patch.proxyUrl = proxyUrl.trim();
    if (geminiKey.trim()) patch.geminiKey = geminiKey.trim();
    onSave(patch);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Settings"
      footer={
        <button
          type="button"
          className="primary-button"
          disabled={!canSave}
          onClick={save}
        >
          Save
        </button>
      }
    >
      <div className="provider-switch" role="tablist" aria-label="AI provider">
        <button
          type="button"
          role="tab"
          aria-selected={provider === "opencode"}
          className={
            provider === "opencode"
              ? "provider-option is-active"
              : "provider-option"
          }
          onClick={() => switchProvider("opencode")}
        >
          OpenCode Go
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={provider === "gemini"}
          className={
            provider === "gemini"
              ? "provider-option is-active"
              : "provider-option"
          }
          onClick={() => switchProvider("gemini")}
        >
          Gemini
        </button>
      </div>

      <p className="provider-model">
        {provider === "opencode"
          ? `DeepSeek V4.1 Flash · ${OPENCODE_MODEL}`
          : `Gemini 3.8 Flash · ${GEMINI_MODEL}`}
      </p>

      {provider === "opencode" ? (
        <div className="settings-fields">
          <label className="field">
            <span>Worker URL</span>
            <input
              type="url"
              inputMode="url"
              value={proxyUrl}
              onChange={(event) => {
                setProxyUrl(event.target.value);
                setTestState("idle");
                setTestMessage("");
              }}
              placeholder="https://cove-proxy.you.workers.dev"
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </label>
          <button
            type="button"
            className="text-button"
            onClick={() => void runTest()}
            disabled={!proxyUrl.trim() || testState === "testing"}
          >
            {testState === "testing" ? "Checking…" : "Test connection"}
          </button>
          {testMessage && (
            <p
              className={
                testState === "error"
                  ? "field-status is-error"
                  : "field-status is-ok"
              }
            >
              {testMessage}
            </p>
          )}
          <p className="field-hint">
            The Worker holds your OpenCode Go key. Deploy it once, then paste its
            URL here.
          </p>
        </div>
      ) : (
        <div className="settings-fields">
          <label className="field">
            <span>Gemini API key</span>
            <input
              type="password"
              value={geminiKey}
              onChange={(event) => setGeminiKey(event.target.value)}
              placeholder={
                settings.geminiKey
                  ? "Saved — paste a new key to replace"
                  : "Paste your key"
              }
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </label>
          <p className="field-hint">
            Calls Google directly from this device. The key stays in this
            browser.
          </p>
        </div>
      )}
    </Sheet>
  );
}
