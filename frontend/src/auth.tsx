import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { api } from "@/src/api";
import { storage } from "@/src/utils/storage";
import type { Address, Favorite, User } from "@/src/types";

const TOKEN_KEY = "auth_token";

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  addAddress: (input: Omit<Address, "id">) => Promise<void>;
  removeAddress: (addressId: string) => Promise<void>;
  updateProfile: (input: { name?: string; phone?: string }) => Promise<void>;
  refreshUser: () => Promise<void>;
  addFavorite: (fav: Omit<Favorite, "id">) => Promise<void>;
  removeFavorite: (favId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await storage.secureGet(TOKEN_KEY, "");
        if (token) {
          const res = await api<{ user: User }>("/auth/me");
          setUser(res.user);
        }
      } catch {
        await storage.secureRemove(TOKEN_KEY);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const authenticate = useCallback(async (path: string, body: Record<string, string>) => {
    const res = await api<{ token: string; user: User }>(path, { method: "POST", json: body });
    await storage.secureSet(TOKEN_KEY, res.token);
    setUser(res.user);
  }, []);

  const signIn = useCallback(
    (email: string, password: string) => authenticate("/auth/login", { email: email.trim().toLowerCase(), password }),
    [authenticate],
  );

  const signUp = useCallback(
    (name: string, email: string, password: string) =>
      authenticate("/auth/register", { name: name.trim(), email: email.trim().toLowerCase(), password }),
    [authenticate],
  );

  const signOut = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
  }, []);

  const addAddress = useCallback(
    async (input: Omit<Address, "id">) => {
      const res = await api<{ user: User }>("/auth/addresses", { method: "POST", json: input });
      setUser(res.user);
    },
    [],
  );

  const removeAddress = useCallback(async (addressId: string) => {
    const res = await api<{ user: User }>(`/auth/addresses/${addressId}`, { method: "DELETE" });
    setUser(res.user);
  }, []);

  const updateProfile = useCallback(async (input: { name?: string; phone?: string }) => {
    const res = await api<{ user: User }>("/auth/me", { method: "PUT", json: input });
    setUser(res.user);
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await api<{ user: User }>("/auth/me");
    setUser(res.user);
  }, []);

  const addFavorite = useCallback(async (fav: Omit<Favorite, "id">) => {
    const res = await api<{ user: User }>("/auth/favorites", { method: "POST", json: fav });
    setUser(res.user);
  }, []);

  const removeFavorite = useCallback(async (favId: string) => {
    const res = await api<{ user: User }>(`/auth/favorites/${favId}`, { method: "DELETE" });
    setUser(res.user);
  }, []);

  const value = useMemo(
    () => ({ user, ready, signIn, signUp, signOut, addAddress, removeAddress, updateProfile, refreshUser, addFavorite, removeFavorite }),
    [user, ready, signIn, signUp, signOut, addAddress, removeAddress, updateProfile, refreshUser, addFavorite, removeFavorite],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
