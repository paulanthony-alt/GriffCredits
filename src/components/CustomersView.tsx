import { useEffect, useMemo, useState, type FormEvent } from "react";
import { formatCredits, MAX_TRANSACTION_CENTS, parseCreditsToCents, sanitizeCreditsInput } from "../money";
import { creditTotals } from "../totals";
import { adjustCredits, createCustomer, friendlyError, undoTransaction, updateCustomer, watchCustomers } from "../services";
import type { CreditTransaction, Customer } from "../types";
import TransactionList from "./TransactionList";

export default function CustomersView({ staffNames, isAdmin }: { staffNames: Map<string, string>; isAdmin: boolean }) {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => watchCustomers(setCustomers, (e) => setError(friendlyError(e))), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!customers) return [];
    return q
      ? customers.filter((c) => c.name.toLowerCase().includes(q) || c.notes.toLowerCase().includes(q))
      : customers;
  }, [customers, search]);

  const selected = customers?.find((c) => c.id === selectedId) ?? null;
  // Across all customers, not just the search results. Updates live as anyone loads or spends.
  const totals = useMemo(() => (customers ? creditTotals(customers) : null), [customers]);

  return (
    <main className="container split">
      {totals && (
        <section className="card totals-card" aria-live="polite">
          <div className="muted">Total credits out there</div>
          <div className="total-amount">{formatCredits(totals.outstandingCents)}</div>
          <div className="muted small">
            held by {totals.customersWithCredit} of {customers!.length} customer{customers!.length === 1 ? "" : "s"}
          </div>
          {isAdmin && <ReportButton staffNames={staffNames} />}
        </section>
      )}
      <section className="card">
        <div className="row spread">
          <h2>Customers</h2>
          <button className="primary" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "Close" : "+ Add customer"}
          </button>
        </div>
        {showAdd && (
          <AddCustomerForm
            onDone={(id) => {
              setShowAdd(false);
              setSelectedId(id);
            }}
          />
        )}
        <input placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {error && <p className="error">{error}</p>}
        {!customers && !error && <p className="muted">Loading…</p>}
        {customers?.length === 0 && <p className="muted">No customers yet. Add one to get started.</p>}
        <ul className="customer-list">
          {filtered.map((c) => (
            <li key={c.id}>
              <button className={c.id === selectedId ? "customer-row selected" : "customer-row"} onClick={() => setSelectedId(c.id)}>
                <span>
                  {c.name}
                  {c.notes && <span className="muted small"> · {c.notes}</span>}
                </span>
                <span className="customer-balance">{formatCredits(c.balanceCents)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        {selected ? (
          <CustomerDetail key={selected.id} customer={selected} staffNames={staffNames} />
        ) : (
          <p className="muted">Select a customer to load or spend credits.</p>
        )}
      </section>
    </main>
  );
}

function ReportButton({ staffNames }: { staffNames: Map<string, string> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setBusy(true);
    setError("");
    try {
      // Loaded on demand: the PDF library is large and only admins use it.
      const { downloadReport } = await import("../report/download");
      await downloadReport(staffNames);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="ghost report-button" onClick={download} disabled={busy}>
        {busy ? "Preparing report…" : "Download report (PDF)"}
      </button>
      {error && <p className="error small">{error}</p>}
    </>
  );
}

function CustomerDetail({ customer, staffNames }: { customer: Customer; staffNames: Map<string, string> }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState(false);

  async function apply(sign: 1 | -1, e?: FormEvent) {
    e?.preventDefault();
    const cents = parseCreditsToCents(amount);
    if (cents === null || cents <= 0) {
      setMessage({ ok: false, text: "Enter an amount like 15 or 15.65." });
      return;
    }
    if (cents > MAX_TRANSACTION_CENTS) {
      setMessage({ ok: false, text: `That's more than ${formatCredits(MAX_TRANSACTION_CENTS)} credits in one go. Check the amount.` });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await adjustCredits(customer.id, sign * cents, note);
      const shown = formatCredits(cents);
      setMessage({ ok: true, text: sign > 0 ? `Loaded ${shown} credits.` : `Took ${shown} credits.` });
      setAmount("");
      setNote("");
    } catch (err) {
      setMessage({ ok: false, text: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  }

  async function undo(t: CreditTransaction) {
    const what = `${t.amountCents > 0 ? "+" : "−"}${formatCredits(Math.abs(t.amountCents))}${t.note ? ` (${t.note})` : ""}`;
    if (!confirm(`Undo ${what} for ${customer.name}? The amount goes back and the history keeps a record of the undo.`)) return;
    setMessage(null);
    try {
      await undoTransaction(customer.id, t.id);
      setMessage({ ok: true, text: `Undid ${what}.` });
    } catch (err) {
      setMessage({ ok: false, text: friendlyError(err) });
    }
  }

  return (
    <>
      <div className="row spread">
        <div>
          <h2>{customer.name}</h2>
          {customer.notes && <div className="muted">{customer.notes}</div>}
          <button className="link" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel edit" : "Edit details"}
          </button>
        </div>
        <div className="balance-sm">
          {formatCredits(customer.balanceCents)}
          <div className="muted small">credits</div>
        </div>
      </div>

      {editing && <EditCustomerForm customer={customer} onDone={() => setEditing(false)} />}

      <form className="adjust" onSubmit={(e) => apply(-1, e)}>
        <label>
          Credits
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(sanitizeCreditsInput(e.target.value))}
            placeholder="e.g. 15.65"
          />
        </label>
        <label>
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. 2 pints" />
        </label>
        <div className="row">
          <button type="submit" className="danger" disabled={busy}>Spend credits</button>
          <button type="button" className="success-btn" disabled={busy} onClick={() => apply(1)}>Load credits</button>
        </div>
        {message && <p className={message.ok ? "success" : "error"}>{message.text}</p>}
      </form>

      <h3>History</h3>
      <TransactionList customerId={customer.id} staffNames={staffNames} onUndo={undo} />
    </>
  );
}

function AddCustomerForm({ onDone }: { onDone: (id: string) => void }) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onDone(await createCustomer(name, notes));
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} required />
      </label>
      <label>
        Notes (optional)
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} placeholder="e.g. darts team, phone ends 123" />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="primary" disabled={busy}>
        {busy ? "Adding…" : "Add customer"}
      </button>
    </form>
  );
}

function EditCustomerForm({ customer, onDone }: { customer: Customer; onDone: () => void }) {
  const [name, setName] = useState(customer.name);
  const [notes, setNotes] = useState(customer.notes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await updateCustomer(customer.id, name, notes);
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
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} required />
      </label>
      <label>
        Notes
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="primary" disabled={busy}>Save</button>
    </form>
  );
}
