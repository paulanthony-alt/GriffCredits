import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { isChunkLoadError, NEW_VERSION_MESSAGE } from "./appUpdate";
import { isConfigured } from "./config";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);

if (!isConfigured) {
  // Firebase throws on startup without settings, so show what's missing instead of a blank page.
  root.render(
    <div className="centered">
      <div className="card narrow">
        <h2>Griff Credits isn't connected yet</h2>
        <p className="muted">
          This build has no Firebase settings. Add them to <code>.env.production</code> (or <code>.env.local</code> for
          local development) as described in SETUP.md, then rebuild.
        </p>
      </div>
    </div>,
  );
} else {
  // Loaded only once we know the config is present, because importing it starts Firebase.
  try {
    const [{ default: App }, { AuthProvider }, { default: ErrorBoundary }] = await Promise.all([
      import("./App"),
      import("./AuthContext"),
      import("./components/ErrorBoundary"),
    ]);
    root.render(
      <StrictMode>
        <ErrorBoundary variant="app">
          <AuthProvider>
            <App />
          </AuthProvider>
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (e) {
    // The app itself couldn't load (e.g. an update went live mid-load): say so, never a blank page.
    console.error(e);
    root.render(
      <div className="centered">
        <div className="card narrow" role="alert">
          <h2>{isChunkLoadError(e) ? "A new version is ready" : "Griff Credits couldn't start"}</h2>
          <p className="muted">{isChunkLoadError(e) ? NEW_VERSION_MESSAGE : "Check the connection, then reload."}</p>
          <button className="primary" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>,
    );
  }
}
