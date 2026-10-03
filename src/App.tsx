import { useAuth } from "./AuthContext";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import { signOutUser } from "./services";

export default function App() {
  const { loading, user, profile } = useAuth();

  if (loading) return <div className="centered muted">Loading…</div>;
  if (!user) return <Login />;

  if (!profile) {
    return (
      <div className="centered">
        <div className="card narrow">
          <h2>No staff access</h2>
          <p className="muted">This login isn't (or is no longer) a Griff staff account. Ask an admin.</p>
          <button onClick={signOutUser}>Sign out</button>
        </div>
      </div>
    );
  }

  return <Dashboard me={profile} />;
}
