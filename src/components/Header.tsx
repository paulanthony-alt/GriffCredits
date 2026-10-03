import { signOutUser } from "../services";
import type { Staff } from "../types";

export default function Header({ me }: { me: Staff }) {
  return (
    <header className="header">
      <div className="brand">Griff Credits</div>
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
