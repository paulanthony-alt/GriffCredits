import { useEffect, useState } from "react";
import { formatCredits } from "../money";
import { friendlyError, undoTxId, watchTransactions } from "../services";
import type { CreditTransaction } from "../types";

interface Props {
  customerId: string;
  /** staff uid -> name; when given, each entry shows who recorded it. */
  staffNames?: Map<string, string>;
  /** When given, entries that can still be undone get an Undo button. */
  onUndo?: (t: CreditTransaction) => Promise<void>;
}

export default function TransactionList({ customerId, staffNames, onUndo }: Props) {
  const [txs, setTxs] = useState<CreditTransaction[] | null>(null);
  const [error, setError] = useState("");
  const [undoingId, setUndoingId] = useState<string | null>(null);

  useEffect(() => {
    setTxs(null);
    return watchTransactions(customerId, setTxs, (e) => setError(friendlyError(e)));
  }, [customerId]);

  if (error) return <p className="error">{error}</p>;
  if (!txs) return <p className="muted">Loading history…</p>;
  if (txs.length === 0) return <p className="muted">No transactions yet.</p>;

  // An undo is always newer than what it reverses, so both are in the list together.
  const ids = new Set(txs.map((t) => t.id));

  async function undo(t: CreditTransaction) {
    setUndoingId(t.id);
    try {
      await onUndo!(t);
    } finally {
      setUndoingId(null);
    }
  }

  return (
    <ul className="tx-list">
      {txs.map((t) => {
        const isUndo = Boolean(t.reversesTxId);
        const undone = ids.has(undoTxId(t.id));
        return (
          <li key={t.id} className={undone ? "undone" : isUndo ? "is-undo" : undefined}>
            <div>
              <div>
                {t.note || (t.amountCents > 0 ? "Credits loaded" : "Credits spent")}
                {undone && <span className="badge muted-badge">Undone</span>}
              </div>
              <div className="muted small">
                {t.createdAt ? t.createdAt.toDate().toLocaleString() : "just now"}
                {staffNames && ` · by ${staffNames.get(t.createdBy) ?? "former staff"}`}
              </div>
            </div>
            <div className="tx-right">
              <div className={t.amountCents > 0 ? "amount plus" : "amount minus"}>
                {t.amountCents > 0 ? "+" : "−"}
                {formatCredits(Math.abs(t.amountCents))}
              </div>
              <div className="muted small">bal {formatCredits(t.balanceAfterCents)}</div>
              {onUndo && !isUndo && !undone && (
                <button className="link" disabled={undoingId !== null} onClick={() => undo(t)}>
                  {undoingId === t.id ? "Undoing…" : "Undo"}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
