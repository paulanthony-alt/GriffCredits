import { useEffect, useState } from "react";
import { formatCredits } from "../money";
import { friendlyError, watchTransactions } from "../services";
import type { CreditTransaction } from "../types";

interface Props {
  customerId: string;
  /** staff uid -> name; when given, each entry shows who recorded it. */
  staffNames?: Map<string, string>;
}

export default function TransactionList({ customerId, staffNames }: Props) {
  const [txs, setTxs] = useState<CreditTransaction[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setTxs(null);
    return watchTransactions(customerId, setTxs, (e) => setError(friendlyError(e)));
  }, [customerId]);

  if (error) return <p className="error">{error}</p>;
  if (!txs) return <p className="muted">Loading history…</p>;
  if (txs.length === 0) return <p className="muted">No transactions yet.</p>;

  return (
    <ul className="tx-list">
      {txs.map((t) => (
        <li key={t.id}>
          <div>
            <div>{t.note || (t.amountCents > 0 ? "Credits loaded" : "Credits spent")}</div>
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
          </div>
        </li>
      ))}
    </ul>
  );
}
