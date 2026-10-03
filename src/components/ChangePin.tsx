import { useState, type FormEvent } from "react";
import { PIN_MAX_LENGTH } from "../pin";
import { changeOwnPin, friendlyError } from "../services";

const digitsOnly = (v: string) => v.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH);

export default function ChangePin() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setMessage({ ok: false, text: "New PINs don't match." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await changeOwnPin(current, next);
      setMessage({ ok: true, text: "PIN changed." });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setMessage({ ok: false, text: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="ghost" onClick={() => setOpen(true)}>
        Change my PIN
      </button>
    );
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3>Change PIN</h3>
      <div className="row">
        <PinField label="Current PIN" value={current} onChange={setCurrent} />
        <PinField label="New PIN" value={next} onChange={setNext} />
        <PinField label="Confirm new PIN" value={confirm} onChange={setConfirm} />
      </div>
      {message && <p className={message.ok ? "success" : "error"}>{message.text}</p>}
      <div className="row">
        <button type="submit" className="primary" disabled={busy}>Save</button>
        <button type="button" className="ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

function PinField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label>
      {label}
      <input type="password" inputMode="numeric" value={value} onChange={(e) => onChange(digitsOnly(e.target.value))} required />
    </label>
  );
}
