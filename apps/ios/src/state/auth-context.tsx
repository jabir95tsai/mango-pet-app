// App-wide auth state, sourced from the native Firebase auth listener.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { FirebaseAuthTypes } from "@react-native-firebase/auth";

import { auth } from "@/lib/firebase";
import { ensureUserProfile } from "@/lib/auth-profile";
import { startPushSession, type PushStatus } from "@/lib/push";

type AuthState = {
  user: FirebaseAuthTypes.User | null;
  initializing: boolean;
  profileError: boolean;
  retryProfile: () => void;
  pushStatus: PushStatus;
};

const AuthContext = createContext<AuthState>({
  user: null,
  initializing: true,
  profileError: false,
  retryProfile: () => {},
  pushStatus: "checking",
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [pushStatus, setPushStatus] = useState<PushStatus>("checking");
  const retryProfile = useCallback(() => setRetry((value) => value + 1), []);

  useEffect(() => {
    let generation = 0;
    let lastIdentity: string | null = null;
    const unsubscribe = auth().onUserChanged((next) => {
      // Native onUserChanged also fires for token refresh. Do not unmount a
      // live walk just because the unchanged identity got a refreshed token.
      const identity = next ? JSON.stringify([next.uid, next.isAnonymous, next.displayName, next.photoURL, next.email, next.providerData]) : "signed-out";
      if (identity === lastIdentity) return;
      lastIdentity = identity;
      const current = ++generation;
      setUser(null);
      setProfileError(false);
      setInitializing(!!next);
      if (!next) return;
      ensureUserProfile(next).then(() => {
        if (generation !== current) return;
        setUser(next);
        setInitializing(false);
      }).catch(() => {
        if (generation !== current) return;
        lastIdentity = null;
        setProfileError(true);
        setInitializing(false);
      });
    });
    return () => { generation++; unsubscribe(); };
  }, [retry]);

  useEffect(() => {
    setPushStatus("checking");
    if (!user) return;
    return startPushSession(user.uid, setPushStatus);
  }, [user]);

  const value = useMemo(() => ({ user, initializing, profileError, retryProfile, pushStatus }), [user, initializing, profileError, retryProfile, pushStatus]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
