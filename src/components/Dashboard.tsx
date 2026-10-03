import { useEffect, useMemo, useState } from "react";
import { friendlyError, watchAllStaff } from "../services";
import type { Staff } from "../types";
import ChangePin from "./ChangePin";
import CustomersView from "./CustomersView";
import Header from "./Header";
import StaffView from "./StaffView";

type Tab = "customers" | "staff";

export default function Dashboard({ me }: { me: Staff }) {
  const [tab, setTab] = useState<Tab>("customers");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffError, setStaffError] = useState("");

  useEffect(() => watchAllStaff(setStaff, (e) => setStaffError(friendlyError(e))), []);

  // Used to show who recorded each transaction.
  const staffNames = useMemo(() => new Map(staff.map((s) => [s.uid, s.name])), [staff]);

  return (
    <>
      <Header me={me} />
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
        <CustomersView staffNames={staffNames} />
      )}
      <div className="container">
        <ChangePin />
      </div>
    </>
  );
}
