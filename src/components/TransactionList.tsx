import { useEffect, useState } from "react";
import { friendlyError, watchTransactions } from "../services";
import type { CreditTransaction } from "../types";

export default function TransactionList({ uid }: { uid: string }) {
  const [txs, setTxs] = useState<CreditTransaction[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setTxs(null);
    return watchTransactions(uid, setTxs, (e) => setError(friendlyError(e)));
  }, [uid]);

  if (error) return <p className="error">{error}</p>;
  if (!txs) return <p className="muted">Loading history…</p>;
  if (txs.length === 0) return <p className="muted">No transactions yet.</p>;

  return (
    <ul className="tx-list">
      {txs.map((t) => (
        <li key={t.id}>
          <div>
            <div>{t.note || (t.amount > 0 ? "Credits added" : "Credits spent")}</div>
            <div className="muted small">{t.createdAt ? t.createdAt.toDate().toLocaleString() : "just now"}</div>
          </div>
          <div className="tx-right">
            <div className={t.amount > 0 ? "amount plus" : "amount minus"}>
              {t.amount > 0 ? "+" : "−"}
              {Math.abs(t.amount)}
            </div>
            <div className="muted small">bal {t.balanceAfter}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
