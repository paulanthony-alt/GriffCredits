import type { Member } from "../types";
import ChangePin from "./ChangePin";
import Header from "./Header";
import TransactionList from "./TransactionList";

export default function MemberDashboard({ me }: { me: Member }) {
  return (
    <>
      <Header me={me} />
      <main className="container">
        <section className="card balance-card">
          <div className="muted">Your balance</div>
          <div className="balance">{me.balance}</div>
          <div className="muted">credits</div>
        </section>
        <section className="card">
          <h2>History</h2>
          <TransactionList uid={me.uid} />
        </section>
        <ChangePin />
      </main>
    </>
  );
}
