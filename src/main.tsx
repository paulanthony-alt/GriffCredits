import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
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
  const [{ default: App }, { AuthProvider }] = await Promise.all([import("./App"), import("./AuthContext")]);
  root.render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>,
  );
}
