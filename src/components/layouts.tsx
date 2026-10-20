import { useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/lib/auth";
import { Button, cx } from "./ui";

export function Logo({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 font-semibold tracking-tight">
      <img src="/favicon.svg" alt="" className="size-7" />
      <span>
        MUMU <span className="text-brand-600">RTC</span>
      </span>
    </Link>
  );
}

// ── Public site ─────────────────────────────────────────────────────────────

export function PublicLayout() {
  const { user, isAdmin } = useAuth();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Logo />
          <nav className="flex items-center gap-1 text-sm">
            <NavLink to="/pricing" className="rounded-md px-3 py-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
              Pricing
            </NavLink>
            <NavLink to="/docs" className="rounded-md px-3 py-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
              Docs
            </NavLink>
            {user ? (
              <Link to={isAdmin ? "/admin" : "/app"}>
                <Button size="sm">Open console</Button>
              </Link>
            ) : (
              <>
                <NavLink to="/login" className="rounded-md px-3 py-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                  Sign in
                </NavLink>
                <Link to="/register">
                  <Button size="sm">Get started</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-500 dark:border-slate-800">
        © {new Date().getFullYear()} MUMU RTC · Real-time audio &amp; video infrastructure
      </footer>
    </div>
  );
}

/** Centered card used by sign-in / register / password pages. */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        <div className="mt-8 rounded-xl bg-white p-6 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}
      </div>
    </div>
  );
}

// ── Guards ──────────────────────────────────────────────────────────────────

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

// ── Console shell (developer app + admin) ───────────────────────────────────

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

function SideNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="space-y-0.5">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              "block rounded-lg px-3 py-2 text-sm font-medium",
              isActive
                ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function ConsoleLayout({ area }: { area: "app" | "admin" }) {
  const { user, isAdmin, can, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Admin sections show only when the role grants them (the backend checks again).
  const adminItems: (NavItem & { show?: boolean })[] = [
    { to: "/admin", label: "Overview", end: true },
    { to: "/admin/nodes", label: "Media nodes", show: can("RTC_MEDIA_NODE", "READ_ALL") },
    { to: "/admin/projects", label: "All projects" },
    { to: "/admin/subscriptions", label: "Subscriptions", show: can("RTC_SUBSCRIPTION", "READ_ALL") },
    { to: "/admin/requests", label: "Plan requests", show: can("RTC_SUBSCRIPTION", "READ_ALL") },
    { to: "/admin/plans", label: "Plans", show: can("RTC_PLAN", "READ_ALL") },
  ];
  const items: NavItem[] =
    area === "admin"
      ? adminItems.filter((i) => i.show !== false)
      : [
          { to: "/app", label: "Projects", end: true },
          { to: "/app/billing", label: "Billing & plan" },
          { to: "/app/account", label: "Account" },
        ];

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <Logo to={area === "admin" ? "/admin" : "/app"} />
      {isAdmin && (
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-0.5 text-center text-xs font-medium dark:bg-slate-800">
          {(["app", "admin"] as const).map((a) => (
            <Link
              key={a}
              to={a === "admin" ? "/admin" : "/app"}
              className={cx("rounded-md py-1", area === a ? "bg-white shadow-sm dark:bg-slate-900" : "text-slate-500")}
            >
              {a === "admin" ? "Admin" : "Console"}
            </Link>
          ))}
        </div>
      )}
      <SideNav items={items} onNavigate={() => setOpen(false)} />
      <div className="mt-auto space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <div className="truncate text-sm font-medium">{user?.name || user?.email}</div>
        {user?.name && <div className="truncate text-xs text-slate-500">{user.email}</div>}
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={async () => {
            await logout();
            navigate("/login");
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
        {sidebar}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-slate-950/50" />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-950/80">
          <button onClick={() => setOpen(true)} className="rounded-md p-1.5 ring-1 ring-slate-300 dark:ring-slate-700" aria-label="Open menu">
            ☰
          </button>
          <Logo to={area === "admin" ? "/admin" : "/app"} />
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
