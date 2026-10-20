import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { api, iam, setTokenHooks } from "./api";
import { config } from "@/config";
import { queryClient } from "./query";

export interface SessionUser {
  userId: string;
  email: string;
  name?: string;
  isEmailVerified: boolean;
  isMasterRealmUser?: boolean;
}

interface Session {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
  /** From mumu-rtc-backend /api/me: holds RTC_PLATFORM:READ_ALL (mumu ADMIN role). */
  isPlatformAdmin?: boolean;
  /** From /api/me: this client's permission strings, e.g. "MUMU-RTC:RTC_PROJECT:CREATE:API_ENDPOINT". */
  permissions?: string[];
}

interface RtcMe {
  isPlatformAdmin: boolean;
  permissions: string[];
}

// ── Session store (module-level so the API client can use it before React mounts) ──

const STORAGE_KEY = "mumu.session";
const listeners = new Set<() => void>();

function load(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

let current: Session | null = load();

function setSession(next: Session | null) {
  current = next;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable (private mode) — session lives in memory only
  }
  if (!next) queryClient.clear();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Keep tabs in sync (logout in one tab logs out the others).
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    current = load();
    if (!current) queryClient.clear();
    listeners.forEach((l) => l());
  });
}

setTokenHooks({
  getAccessToken: () => current?.accessToken ?? null,
  refresh: async () => {
    const session = current;
    if (!session) return null;
    try {
      const { accessToken } = await iam<{ accessToken: string }>("/api/auth/refresh", {
        method: "POST",
        auth: false,
        body: { refreshToken: session.refreshToken },
      });
      // Don't resurrect a session that was logged out while refreshing.
      if (current?.refreshToken === session.refreshToken) {
        setSession({ ...current, accessToken });
        // IAM rebuilds the permission cache on refresh — pick up role changes.
        void refreshMe();
      }
      return accessToken;
    } catch {
      if (current?.refreshToken === session.refreshToken) setSession(null);
      return null;
    }
  },
});

/** Header identifying the IAM client+realm (cryptdox · mumu) for unauthenticated auth calls. */
export const accessCodeHeader = () => ({ "x-cr-access-code": config.iamAccessCode });

/** Load the caller's MUMU permissions and platform-admin flag from mumu-rtc-backend. */
async function refreshMe() {
  const session = current;
  if (!session) return;
  try {
    const me = await api<RtcMe>("/api/me");
    if (!current || current.refreshToken !== session.refreshToken) return;
    const samePerms = (current.permissions ?? []).join() === me.permissions.join();
    if (current.isPlatformAdmin !== me.isPlatformAdmin || !samePerms) {
      setSession({ ...current, isPlatformAdmin: me.isPlatformAdmin, permissions: me.permissions });
    }
  } catch {
    // backend unreachable — keep the last known values
  }
}

// Role changes in IAM show up on app load and after every token refresh.
if (current) void refreshMe();

/** True when `permissions` grant `action` on `resource` (e.g. "RTC_PROJECT", "CREATE"). */
export function hasPermission(permissions: string[] | undefined, resource: string, action: string) {
  return (permissions ?? []).some((p) => {
    const [, res, act] = p.split(":");
    return res === resource && act === action;
  });
}

// ── React binding ───────────────────────────────────────────────────────────

interface AuthContextValue {
  user: SessionUser | null;
  isAdmin: boolean;
  /** Does the user hold `action` on `resource`? Checked again by the backend; this only shapes the UI. */
  can: (resource: string, action: string) => boolean;
  login: (input: { email: string; password: string; captchaToken: string }) => Promise<{ user: SessionUser; isPlatformAdmin: boolean }>;
  register: (input: { email: string; password: string; name?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<SessionUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribe, () => current);

  const login = useCallback<AuthContextValue["login"]>(async ({ email, password, captchaToken }) => {
    const data = await iam<Session>("/api/auth/login", {
      method: "POST",
      auth: false,
      headers: accessCodeHeader(),
      body: { email, password, captchaToken },
    });
    queryClient.clear();
    setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
    await refreshMe();
    return { user: data.user, isPlatformAdmin: !!current?.isPlatformAdmin };
  }, []);

  const register = useCallback<AuthContextValue["register"]>(async (input) => {
    await iam("/api/auth/register", { method: "POST", auth: false, headers: accessCodeHeader(), body: input });
  }, []);

  const logout = useCallback(async () => {
    try {
      if (current) await iam("/api/auth/logout", { method: "POST" });
    } catch {
      // token may already be invalid — clear locally regardless
    }
    setSession(null);
  }, []);

  const updateUser = useCallback((patch: Partial<SessionUser>) => {
    if (current) setSession({ ...current, user: { ...current.user, ...patch } });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      isAdmin: !!session?.isPlatformAdmin,
      can: (resource: string, action: string) => hasPermission(session?.permissions, resource, action),
      login,
      register,
      logout,
      updateUser,
    }),
    [session, login, register, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
