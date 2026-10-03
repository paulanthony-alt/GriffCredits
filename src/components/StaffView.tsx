import { useState, type FormEvent } from "react";
import { PIN_MAX_LENGTH } from "../pin";
import { createStaff, friendlyError, removeStaff } from "../services";
import type { Staff, StaffRole } from "../types";

interface Props {
  me: Staff;
  staff: Staff[];
  error: string;
}

/** Admin-only: manage who can sign in to the app. */
export default function StaffView({ me, staff, error }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [actionError, setActionError] = useState("");

  async function remove(s: Staff) {
    if (!confirm(`Remove ${s.name}'s access? They won't be able to sign in to the app any more.`)) return;
    setActionError("");
    try {
      await removeStaff(s.uid);
    } catch (err) {
      setActionError(friendlyError(err));
    }
  }

  return (
    <main className="container">
      <section className="card">
        <div className="row spread">
          <h2>Staff</h2>
          <button className="primary" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "Close" : "+ Add staff"}
          </button>
        </div>
        {showAdd && <AddStaffForm onDone={() => setShowAdd(false)} />}
        {(error || actionError) && <p className="error">{error || actionError}</p>}
        <ul className="tx-list">
          {staff.map((s) => (
            <li key={s.uid}>
              <div>
                {s.name} <span className="muted small">@{s.username}</span>
                {s.role === "admin" && <span className="badge">admin</span>}
              </div>
              {s.uid !== me.uid && (
                <button className="ghost" onClick={() => remove(s)}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function AddStaffForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createStaff(name, username, pin, role);
      onDone();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Username
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" required />
      </label>
      <label>
        Starting PIN
        <input
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH))}
          required
        />
      </label>
      <label>
        Role
        <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
          <option value="staff">Staff: manage customers and credits</option>
          <option value="admin">Admin: also manage staff</option>
        </select>
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="primary" disabled={busy}>
        {busy ? "Creating…" : "Create staff account"}
      </button>
    </form>
  );
}
