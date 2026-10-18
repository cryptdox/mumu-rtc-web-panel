import { config } from "@/config";

/** Error carrying the HTTP status and the API's message / field errors. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
  headers?: Record<string, string>;
  /** Attach the IAM access token and refresh it on 401 (default true). */
  auth?: boolean;
}

// ── Token plumbing (wired up by AuthProvider) ────────────────────────────────

interface TokenHooks {
  getAccessToken: () => string | null;
  /** Try to obtain a new access token; resolve null when the session is gone. */
  refresh: () => Promise<string | null>;
}

let hooks: TokenHooks = { getAccessToken: () => null, refresh: async () => null };
export function setTokenHooks(next: TokenHooks) {
  hooks = next;
}

// One refresh at a time, shared by all requests that hit 401 concurrently.
let refreshing: Promise<string | null> | null = null;
function refreshOnce() {
  refreshing ??= hooks.refresh().finally(() => (refreshing = null));
  return refreshing;
}

function buildUrl(base: string, path: string, query?: Query) {
  const url = new URL(base + path);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function send<T>(base: string, path: string, opts: RequestOptions, token: string | null): Promise<T> {
  const res = await fetch(buildUrl(base, path, opts.query), {
    method: opts.method ?? "GET",
    headers: {
      ...(opts.body !== undefined && { "content-type": "application/json" }),
      ...(token && { authorization: `Bearer ${token}` }),
      ...opts.headers,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // empty or non-JSON body
  }

  if (!res.ok || json?.success === false) {
    throw new ApiError(res.status, json?.message ?? res.statusText ?? "Request failed", json?.errors);
  }
  // Both backends wrap payloads as { success, status, message, data }
  return (json && "data" in json ? json.data : json) as T;
}

async function request<T>(base: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const useAuth = opts.auth !== false;
  const token = useAuth ? hooks.getAccessToken() : null;
  try {
    return await send<T>(base, path, opts, token);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401 || !useAuth || !token) throw err;
    const fresh = await refreshOnce();
    if (!fresh) throw err;
    return send<T>(base, path, opts, fresh);
  }
}

/** mumu-rtc-backend (control plane) */
export const api = <T>(path: string, opts?: RequestOptions) => request<T>(config.apiUrl, path, opts);

/** crypt-iam */
export const iam = <T>(path: string, opts?: RequestOptions) => request<T>(config.iamUrl, path, opts);

/** Human-readable message for any thrown value. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403 && /access denied|permissions not loaded/i.test(err.message)) {
      return "Your account doesn't have permission for this action. Ask a platform admin to grant the MUMU RTC role.";
    }
    if (err.errors?.length) return `${err.message}: ${err.errors.map((e) => `${e.path} ${e.message}`).join("; ")}`;
    return err.message;
  }
  if (err instanceof TypeError) return "Network error — is the server reachable?";
  return err instanceof Error ? err.message : String(err);
}
