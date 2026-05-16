/**
 * Auth context.
 * Wraps Auth0 integration. The token is stored in memory (never localStorage)
 * to reduce XSS exposure. Configure AUTH0_DOMAIN and AUTH0_CLIENT_ID via
 * VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID env vars.
 *
 * Role claim is read from the Auth0 token at namespace
 * `https://eso.internal/role`. Configure this in your Auth0 Actions.
 */

import React, { createContext, useCallback, useContext, useState } from "react";
import type { AuthUser } from "@/types";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  hasRole: (role: AuthUser["role"]) => boolean;
  login: () => void;
  logout: () => void;
  /** Called by the Auth0 callback handler with the decoded user + raw token. */
  _setSession: (user: AuthUser, token: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ESO_ROLE_CLAIM = "https://eso.internal/role";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const _setSession = useCallback((u: AuthUser, t: string) => {
    setUser(u);
    setToken(t);
  }, []);

  const login = useCallback(() => {
    const domain = import.meta.env.VITE_AUTH0_DOMAIN as string;
    const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string;
    const redirectUri = encodeURIComponent(`${window.location.origin}/callback`);
    window.location.href =
      `https://${domain}/authorize?response_type=token&client_id=${clientId}` +
      `&redirect_uri=${redirectUri}&scope=openid%20profile%20email&audience=${
        import.meta.env.VITE_AUTH0_AUDIENCE as string
      }`;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    const domain = import.meta.env.VITE_AUTH0_DOMAIN as string;
    const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string;
    window.location.href =
      `https://${domain}/v2/logout?client_id=${clientId}&returnTo=${encodeURIComponent(window.location.origin)}`;
  }, []);

  const hasRole = useCallback(
    (role: AuthUser["role"]) => user?.role === role,
    [user],
  );

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!user, hasRole, login, logout, _setSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

/** Parses the role claim out of a decoded Auth0 JWT payload. */
export function extractRole(payload: Record<string, unknown>): AuthUser["role"] {
  const raw = payload[ESO_ROLE_CLAIM];
  if (raw === "supervisor" || raw === "compliance" || raw === "agent") return raw;
  return "agent";
}
