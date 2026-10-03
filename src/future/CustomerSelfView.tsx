/**
 * NOT USED YET. Parked for a future "customers check their own balance" feature.
 *
 * Today only Griff staff sign in. To switch this on later:
 *  1. Give customers a login. createStaff() in services.ts shows how to create
 *     a username + PIN account; store the new auth uid on the customer
 *     document (e.g. `authUid`).
 *  2. In firestore.rules, let a signed-in customer read their own
 *     customers/{id} document and its transactions (match on `authUid`).
 *  3. In App.tsx, when the signed-in user is a customer rather than staff,
 *     render <CustomerSelfView customer={...} /> instead of the staff Dashboard.
 */
import { formatCredits } from "../money";
import { signOutUser } from "../services";
import type { Customer } from "../types";
import TransactionList from "../components/TransactionList";

export default function CustomerSelfView({ customer }: { customer: Customer }) {
  return (
    <>
      <header className="header">
        <div className="brand">Griff Credits</div>
        <div className="header-right">
          <span className="muted">{customer.name}</span>
          <button className="ghost" onClick={signOutUser}>Sign out</button>
        </div>
      </header>
      <main className="container">
        <section className="card balance-card">
          <div className="muted">Your balance</div>
          <div className="balance">{formatCredits(customer.balanceCents)}</div>
          <div className="muted">credits</div>
        </section>
        <section className="card">
          <h2>History</h2>
          <TransactionList customerId={customer.id} />
        </section>
      </main>
    </>
  );
}
