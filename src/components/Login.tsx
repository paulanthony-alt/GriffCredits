import { useEffect, useState, type FormEvent } from "react";
import { isValidPin, PIN_MAX_LENGTH, PIN_MIN_LENGTH } from "../pin";
import { createFirstAdmin, friendlyError, isSetupComplete, signInWithPin } from "../services";
import PinPad from "./PinPad";

const LAST_USERNAME_KEY = "griff-credits:last-username";

function readLastUsername(): string {
  try {
    return localStorage.getItem(LAST_USERNAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function Login() {
  const [setupDone, setSetupDone] = useState<boolean | null>(null);
  const [setupError, setSetupError] = useState("");

  useEffect(() => {
    isSetupComplete()
      .then(setSetupDone)
      .catch((e) => setSetupError(friendlyError(e)));
  }, []);

  if (setupError) return <div className="centered error">Couldn't connect: {setupError}</div>;
  if (setupDone === null) return <div className="centered muted">Loading…</div>;
  return setupDone ? <PinLogin /> : <FirstTimeSetup />;
}

function PinLogin() {
  const [username, setUsername] = useState(readLastUsername);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Let a physical keyboard type the PIN too, unless the username box has focus.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < PIN_MAX_LENGTH ? p + e.key : p));
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!username.trim() || !isValidPin(pin)) {
      setError(`Enter your username and a ${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digit PIN.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await signInWithPin(username, pin);
      try {
        localStorage.setItem(LAST_USERNAME_KEY, username.trim());
      } catch {
        // Remembering the username is only a convenience.
      }
    } catch (err) {
      setError(friendlyError(err));
      setPin("");
      setBusy(false);
    }
  }

  return (
    <div className="centered">
      <form className="card narrow" onSubmit={submit}>
        <h1 className="brand-lg">Griff Credits</h1>
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoComplete="username"
            autoFocus={!username}
          />
        </label>
        <PinPad value={pin} onChange={setPin} disabled={busy} />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="primary wide" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

function FirstTimeSetup() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createFirstAdmin(name, username, pin);
      // AuthContext picks up the new session and shows the admin dashboard.
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <div className="centered">
      <form className="card narrow" onSubmit={submit}>
        <h1 className="brand-lg">Welcome to Griff Credits</h1>
        <p className="muted">No accounts exist yet. Create the first admin account to get started.</p>
        <label>
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" required />
        </label>
        <label>
          PIN ({PIN_MIN_LENGTH}–{PIN_MAX_LENGTH} digits)
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH))}
            inputMode="numeric"
            type="password"
            autoComplete="new-password"
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="primary wide" disabled={busy}>
          {busy ? "Creating…" : "Create admin account"}
        </button>
      </form>
    </div>
  );
}
