import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PIN_MAX_LENGTH } from "../pin";
import { adjustCredits, createMember, friendlyError, watchAllMembers } from "../services";
import type { Member, Role } from "../types";
import ChangePin from "./ChangePin";
import Header from "./Header";
import TransactionList from "./TransactionList";

export default function AdminDashboard({ me }: { me: Member }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => watchAllMembers(setMembers, (e) => setError(friendlyError(e))), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!members) return [];
    return q ? members.filter((m) => m.name.toLowerCase().includes(q) || m.username.includes(q)) : members;
  }, [members, search]);

  const selected = members?.find((m) => m.uid === selectedUid) ?? null;

  return (
    <>
      <Header me={me} />
      <main className="container admin">
        <section className="card">
          <div className="row spread">
            <h2>Members</h2>
            <button className="primary" onClick={() => setShowAdd((v) => !v)}>
              {showAdd ? "Close" : "+ Add member"}
            </button>
          </div>
          {showAdd && <AddMemberForm onDone={() => setShowAdd(false)} />}
          <input placeholder="Search name or username…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {error && <p className="error">{error}</p>}
          {!members && !error && <p className="muted">Loading…</p>}
          <ul className="member-list">
            {filtered.map((m) => (
              <li key={m.uid}>
                <button className={m.uid === selectedUid ? "member selected" : "member"} onClick={() => setSelectedUid(m.uid)}>
                  <span>
                    {m.name} <span className="muted small">@{m.username}</span>
                    {m.role === "admin" && <span className="badge">admin</span>}
                  </span>
                  <span className="member-balance">{m.balance}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          {selected ? (
            <MemberDetail member={selected} />
          ) : (
            <p className="muted">Select a member to add or spend credits.</p>
          )}
        </section>

        <ChangePin />
      </main>
    </>
  );
}

function MemberDetail({ member }: { member: Member }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setAmount("");
    setNote("");
    setMessage(null);
  }, [member.uid]);

  async function apply(sign: 1 | -1, e?: FormEvent) {
    e?.preventDefault();
    const n = Number(amount);
    if (!Number.isInteger(n) || n <= 0) {
      setMessage({ ok: false, text: "Enter a whole number of credits." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await adjustCredits(member.uid, sign * n, note);
      setMessage({ ok: true, text: sign > 0 ? `Added ${n} credits.` : `Spent ${n} credits.` });
      setAmount("");
      setNote("");
    } catch (err) {
      setMessage({ ok: false, text: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="row spread">
        <div>
          <h2>{member.name}</h2>
          <div className="muted">@{member.username}</div>
        </div>
        <div className="balance-sm">
          {member.balance}
          <div className="muted small">credits</div>
        </div>
      </div>

      <form className="adjust" onSubmit={(e) => apply(-1, e)}>
        <label>
          Credits
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            placeholder="e.g. 5"
          />
        </label>
        <label>
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. 2 pints" />
        </label>
        <div className="row">
          <button type="submit" className="danger" disabled={busy}>Spend</button>
          <button type="button" className="success-btn" disabled={busy} onClick={() => apply(1)}>Add credits</button>
        </div>
        {message && <p className={message.ok ? "success" : "error"}>{message.text}</p>}
      </form>

      <h3>History</h3>
      <TransactionList uid={member.uid} />
    </>
  );
}

function AddMemberForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createMember(name, username, pin, role);
      onDone();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <form className="add-member" onSubmit={submit}>
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
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="primary" disabled={busy}>
        {busy ? "Creating…" : "Create member"}
      </button>
    </form>
  );
}
