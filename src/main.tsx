import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import "@fontsource-variable/inter/index.css";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles.css";

if (!import.meta.env.VITE_NATIVE) {
  registerSW({ immediate: true });
}

if (Capacitor.isNativePlatform()) {
  void (async () => {
    const [{ App: NativeApp }, { StatusBar, Style }] = await Promise.all([
      import("@capacitor/app"),
      import("@capacitor/status-bar"),
    ]);

    await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
    await StatusBar.setBackgroundColor({ color: "#212121" }).catch(
      () => undefined,
    );
    await StatusBar.setOverlaysWebView({ overlay: false }).catch(
      () => undefined,
    );

    NativeApp.addListener("backButton", () => {
      const close = document.querySelector<HTMLElement>(
        ".sheet-close, .image-close, .overlay-close",
      );
      if (close) {
        close.click();
        return;
      }

      const hash = window.location.hash;
      if (!hash || hash === "#" || hash === "#/") {
        void NativeApp.exitApp();
        return;
      }

      if (hash.startsWith("#/lesson/")) {
        const noteId = sessionStorage.getItem("cove.parentNote");
        if (noteId) {
          window.location.hash = `#/note/${noteId}`;
          return;
        }
      }

      window.location.hash = "#/";
    });
  })();
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element missing");

createRoot(root).render(<App />);
