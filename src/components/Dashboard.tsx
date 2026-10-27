import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { friendlyError, watchAllStaff } from "../services";
import type { Staff } from "../types";
import ChangePin from "./ChangePin";
import CustomersView from "./CustomersView";
import Header from "./Header";
import StaffView from "./StaffView";

// Loaded only when someone opens it.
const TrendsPanel = lazy(() => import("./trends/TrendsPanel"));

type Tab = "customers" | "staff";

export default function Dashboard({ me }: { me: Staff }) {
  const [tab, setTab] = useState<Tab>("customers");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffError, setStaffError] = useState("");
  const [showTrends, setShowTrends] = useState(false);

  useEffect(() => watchAllStaff(setStaff, (e) => setStaffError(friendlyError(e))), []);

  // Used to show who recorded each transaction.
  const staffNames = useMemo(() => new Map(staff.map((s) => [s.uid, s.name])), [staff]);

  return (
    <>
      <Header me={me} onOpenTrends={() => setShowTrends(true)} />
      {showTrends && (
        <Suspense fallback={null}>
          <TrendsPanel onClose={() => setShowTrends(false)} />
        </Suspense>
      )}
      {me.role === "admin" && (
        <nav className="tabs">
          <button className={tab === "customers" ? "tab active" : "tab"} onClick={() => setTab("customers")}>
            Customers
          </button>
          <button className={tab === "staff" ? "tab active" : "tab"} onClick={() => setTab("staff")}>
            Staff
          </button>
        </nav>
      )}
      {tab === "staff" && me.role === "admin" ? (
        <StaffView me={me} staff={staff} error={staffError} />
      ) : (
        <CustomersView staffNames={staffNames} isAdmin={me.role === "admin"} />
      )}
      <div className="container">
        <ChangePin />
      </div>
    </>
  );
}
