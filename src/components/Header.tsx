import { signOutUser } from "../services";
import type { Staff } from "../types";

export default function Header({ me, onOpenTrends }: { me: Staff; onOpenTrends?: () => void }) {
  return (
    <header className="header">
      <div className="header-left">
        {onOpenTrends && (
          <button className="ghost trends-button" onClick={onOpenTrends} aria-label="Show credits trends">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            Trends
          </button>
        )}
        <div className="brand">Griff Credits</div>
      </div>
      <div className="header-right">
        <span className="muted">
          {me.name}
          {me.role === "admin" && <span className="badge">admin</span>}
        </span>
        <button className="ghost" onClick={signOutUser}>Sign out</button>
      </div>
    </header>
  );
}
