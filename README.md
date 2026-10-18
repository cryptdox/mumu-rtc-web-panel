# mumu-rtc-web-panel

Web front end for the MUMU RTC platform. One app with three areas:

| Area | Path | Who | What |
| --- | --- | --- | --- |
| **Public site** | `/`, `/docs`, `/login`, `/register`, … | Everyone | Landing page, quickstart docs, sign-in, sign-up, password reset, email verification |
| **Developer console** | `/app` | Subscribers (developers) | Projects, API keys, channels and live rooms, sessions and media stats, recordings, test tokens, usage, webhooks and the event log, account |
| **Platform admin** | `/admin` | Users with the mumu **ADMIN** role | Fleet overview, media nodes (drain / activate / force offline / remove), all projects |

Stack: React 19, Vite 7, TypeScript, React Router 7, TanStack Query 5, Tailwind CSS 4. No other runtime dependencies.

## How it connects

```
Browser ──► crypt-iam            sign-in, sign-up, refresh, profile, passwords
        └─► mumu-rtc-backend     everything else, with the IAM access token as Bearer
```

- **Sign-in:** `POST {IAM}/api/auth/login` with the `x-cr-access-code` header and `{ email, password, captchaToken }`.
  - The CAPTCHA is Cloudflare Turnstile.
  - Everyone (subscribers and MUMU admins) signs in through the `mumu` client of the `cryptdox` realm.
- **Who is an admin:** after sign-in the panel calls `GET /api/me` on mumu-rtc-backend.
  - Users whose IAM roles grant `RTC_PLATFORM:READ_ALL` (the mumu **ADMIN** role) are platform admins and can open `/admin`.
  - IAM master-realm super-admins are *not* MUMU admins unless they are given that role.
- **Sessions:** the access and refresh tokens are kept in `localStorage`.
  - On a 401 the client refreshes once (`POST /api/auth/refresh`) and retries.
  - If the refresh fails, the user is signed out.
- **Admin access to projects:** platform admins can open any project from **All projects**. The backend lets `RTC_PLATFORM:READ_ALL` holders through its ownership checks.

## Run locally

```bash
cp .env.example .env     # then fill in the values
pnpm install
pnpm dev                 # http://localhost:5173
```

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | mumu-rtc-backend base URL |
| `VITE_IAM_URL` | crypt-iam base URL |
| `VITE_IAM_ACCESS_CODE` | `x-cr-access-code` of the mumu client in the cryptdox realm (used for sign-in, sign-up and password reset) |
| `VITE_TURNSTILE_SITE_KEY` | Turnstile site key. **Required in production.** Dev builds fall back to Cloudflare's always-pass test key, which matches IAM's test secret outside PROD. |

Things to set up on the IAM side:

- **Permissions:** run `node scripts/iam-setup.mjs` in mumu-rtc-backend once. It creates the `RTC_*` resources on the `mumu` client and grants them to its roles.
  - **USER:** everything except media nodes and platform admin. IAM gives new sign-ups this role automatically.
  - **ADMIN:** everything, including `RTC_MEDIA_NODE` and `RTC_PLATFORM`.
  - To make someone a MUMU admin, give them mumu's `ADMIN` role in IAM.
- **Email links:** IAM builds them as `{FRONTEND_URL}/verify-email?token=…` and `{FRONTEND_URL}/reset-password?token=…`. Point IAM's `FRONTEND_URL` at this panel so they land on the matching pages.

## Build and deploy

```bash
pnpm build      # type-checks, then outputs dist/
```

Docker serves the static build with nginx (SPA fallback, long-cached assets). `VITE_*` values are baked in at build time:

```bash
docker build \
  --build-arg VITE_API_URL=https://api.example.com \
  --build-arg VITE_IAM_URL=https://iam.example.com \
  --build-arg VITE_IAM_ACCESS_CODE=... \
  --build-arg VITE_TURNSTILE_SITE_KEY=... \
  -t mumu-rtc-web-panel .
docker run -p 8080:80 mumu-rtc-web-panel
```

## Layout

```
src/
  config.ts            env → runtime config
  lib/api.ts           fetch wrapper: envelope unwrapping, ApiError, 401 → refresh → retry
  lib/auth.tsx         session store + AuthProvider (login, register, logout, refresh)
  api/                 typed endpoint functions (rtc.ts → backend, account.ts → IAM) and types
  components/ui.tsx    UI kit (Button, Card, Table, Modal, ConfirmModal, SecretRevealModal, …)
  components/layouts   public layout, console shell, route guards
  pages/public/        landing, docs, auth pages
  pages/app/           developer console
  pages/admin/         platform admin
```
