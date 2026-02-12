import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirebaseClients, upsertUserProfile, updatePresence } from '@messenger/shared';
import { initMobileFirebase } from '../lib/firebase';

type UserState = { uid: string; email: string | null; displayName: string | null } | null;

const AuthContext = createContext<{
  user: UserState;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}>({
  user: null,
  loading: true,
  signIn: async () => undefined,
  register: async () => undefined,
  logout: async () => undefined
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserState>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initMobileFirebase();
    const { auth } = getFirebaseClients();

    const unsub = onAuthStateChanged(auth, async (current) => {
      if (!current) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser({ uid: current.uid, email: current.email, displayName: current.displayName });
      await upsertUserProfile({
        uid: current.uid,
        email: current.email ?? '',
        displayName: current.displayName ?? current.email?.split('@')[0] ?? 'User',
        photoURL: current.photoURL
      });
      await updatePresence(current.uid);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      signIn: async (email: string, password: string) => {
        await signInWithEmailAndPassword(getFirebaseClients().auth, email, password);
      },
      register: async (email: string, password: string, displayName: string) => {
        const cred = await createUserWithEmailAndPassword(getFirebaseClients().auth, email, password);
        await upsertUserProfile({ uid: cred.user.uid, email, displayName, photoURL: null });
      },
      logout: async () => {
        await signOut(getFirebaseClients().auth);
      }
    }),
    [loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
