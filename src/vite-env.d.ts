/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_COVE_PROXY_URL?: string;
  readonly VITE_NATIVE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
