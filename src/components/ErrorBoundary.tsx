import { Component, type ErrorInfo, type ReactNode } from "react";
import { isChunkLoadError, reloadApp } from "../appUpdate";

interface Props {
  children: ReactNode;
  /** "app": whole-screen fallback. "panel": a pop-up for a part of the app that failed to open. */
  variant: "app" | "panel";
  onClose?: () => void;
}

/**
 * Catches anything that breaks while drawing the screen, so staff see a clear
 * message with a Reload button instead of a blank page. Nothing typed into the
 * database is lost: every load and spend is saved the moment it's confirmed.
 */
export default class ErrorBoundary extends Component<Props, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Griff Credits hit an error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const update = isChunkLoadError(this.state.error);
    const title = update ? "A new version is ready" : "Something went wrong";
    const text = update
      ? "Griff Credits was updated while this page was open. Reload to get the latest version. Nothing you've saved is lost."
      : "This screen hit a problem. Reloading usually fixes it, and nothing you've saved is lost.";

    const card = (
      <div className="card narrow" role="alert">
        <h2>{title}</h2>
        <p className="muted">{text}</p>
        <div className="row">
          <button className="primary" onClick={reloadApp} autoFocus>Reload</button>
          {this.props.variant === "panel" && this.props.onClose && (
            <button className="ghost" onClick={() => { this.setState({ error: null }); this.props.onClose!(); }}>
              Close
            </button>
          )}
        </div>
      </div>
    );

    return this.props.variant === "app" ? <div className="centered">{card}</div> : <div className="overlay">{card}</div>;
  }
}
