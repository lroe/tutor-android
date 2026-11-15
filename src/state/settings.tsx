import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AIProvider, Settings } from "../lib/types";

const STORAGE_KEY = "cove.settings.v1";
const BUILD_PROXY_URL = (import.meta.env.VITE_COVE_PROXY_URL ?? "").trim();

const DEFAULT_SETTINGS: Settings = {
  provider: "opencode",
  proxyUrl: BUILD_PROXY_URL,
  geminiKey: "",
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings> & {
      apiKey?: string;
      model?: string;
    };
    const provider: AIProvider =
      parsed.provider === "gemini" || parsed.provider === "opencode"
        ? parsed.provider
        : "opencode";
    const proxyUrl =
      typeof parsed.proxyUrl === "string" && parsed.proxyUrl.trim()
        ? parsed.proxyUrl.trim()
        : BUILD_PROXY_URL;
    const geminiKey =
      typeof parsed.geminiKey === "string"
        ? parsed.geminiKey.trim()
        : typeof parsed.apiKey === "string"
          ? parsed.apiKey.trim()
          : "";
    return { provider, proxyUrl, geminiKey };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // The app still works for this session if storage is blocked or full.
    }
  }, [settings]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside SettingsProvider");
  return value;
}
