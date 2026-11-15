import { useEffect } from "react";
import { SettingsProvider } from "./state/settings";
import { useHashRoute } from "./hooks/useHashRoute";
import { Home } from "./views/Home";
import { Lesson } from "./views/Lesson";
import { Note } from "./views/Note";

function AppFrame() {
  const { route, navigate } = useHashRoute();

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      document.documentElement.style.setProperty(
        "--app-height",
        `${Math.round(viewport.height)}px`,
      );
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div className="app-viewport">
      <div className="app-frame">
        {route.name === "lesson" ? (
          <Lesson key={route.id} id={route.id} navigate={navigate} />
        ) : route.name === "note" ? (
          <Note
            key={route.id}
            id={route.id}
            autoPages={route.autoPages}
            navigate={navigate}
          />
        ) : (
          <Home navigate={navigate} />
        )}
        <div id="app-portal" className="app-portal" />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AppFrame />
    </SettingsProvider>
  );
}
