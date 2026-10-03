import { useAuth } from "./AuthContext";
import AdminDashboard from "./components/AdminDashboard";
import Login from "./components/Login";
import MemberDashboard from "./components/MemberDashboard";
import { signOutUser } from "./services";

export default function App() {
  const { loading, user, profile } = useAuth();

  if (loading) return <div className="centered muted">Loading…</div>;
  if (!user) return <Login />;

  if (!profile) {
    return (
      <div className="centered">
        <div className="card narrow">
          <h2>Account not set up</h2>
          <p className="muted">You're signed in, but there's no member profile for this account. Ask a Griff admin.</p>
          <button onClick={signOutUser}>Sign out</button>
        </div>
      </div>
    );
  }

  return profile.role === "admin" ? <AdminDashboard me={profile} /> : <MemberDashboard me={profile} />;
}
