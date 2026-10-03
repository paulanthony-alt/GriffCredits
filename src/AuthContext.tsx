import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { auth } from "./firebase";
import { watchMember } from "./services";
import type { Member } from "./types";

interface AuthState {
  /** True until we know whether someone is signed in and have loaded their profile. */
  loading: boolean;
  user: User | null;
  profile: Member | null;
}

const AuthContext = createContext<AuthState>({ loading: true, user: null, profile: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ loading: true, user: null, profile: null });

  useEffect(() => {
    let stopProfile: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopProfile?.();
      stopProfile = undefined;
      if (!user) {
        setState({ loading: false, user: null, profile: null });
        return;
      }
      setState({ loading: true, user, profile: null });
      stopProfile = watchMember(
        user.uid,
        (profile) => setState({ loading: false, user, profile }),
        () => setState({ loading: false, user, profile: null }),
      );
    });
    return () => {
      stopProfile?.();
      stopAuth();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
