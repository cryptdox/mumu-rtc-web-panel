import type { ReactNode } from "react";
import type { BillingCycle, Plan, PlanLimits, PlanTier } from "@/api/types";
import { formatNumber, humanize } from "@/lib/format";
import { Badge, Button, cx } from "./ui";

export const TIER_ORDER: PlanTier[] = ["TRIAL", "FREE", "STARTER", "GROWTH", "BUSINESS", "PRO", "SCALE", "ENTERPRISE"];

export const LIMIT_LABELS: Record<keyof PlanLimits, string> = {
  maxProjects: "Projects",
  maxChannelsPerProject: "Channels per project",
  maxConcurrentPeersPerChannel: "Participants per channel",
  monthlyMinutes: "Minutes / month",
  monthlyRecordingMinutes: "Recording minutes / month",
};
export const LIMIT_KEYS = Object.keys(LIMIT_LABELS) as (keyof PlanLimits)[];

/** null = unlimited. */
export const formatLimit = (v: number | null | undefined) => (v == null ? "Unlimited" : formatNumber(v, 0));

export function formatPrice(price: number | null | undefined, cycle?: BillingCycle) {
  if (price == null) return "Contact us";
  if (price === 0) return "Free";
  return `$${formatNumber(price, 2)}${cycle ? (cycle === "YEARLY" ? " / year" : " / month") : ""}`;
}

export const planName = (p: { tier: PlanTier | string; billingCycle?: BillingCycle | string }) =>
  `${humanize(p.tier)}${p.billingCycle && p.tier !== "TRIAL" && p.tier !== "FREE" ? ` · ${humanize(p.billingCycle)}` : ""}`;

/** FREE is stored with a far-future expiry — show it as never expiring. */
export const neverExpires = (expiresAt: string) => new Date(expiresAt).getUTCFullYear() - new Date().getUTCFullYear() > 50;

export function sortPlans<T extends { tier: PlanTier; billingCycle: BillingCycle }>(plans: T[]) {
  return [...plans].sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || a.billingCycle.localeCompare(b.billingCycle));
}

/** Card grid of plans for one billing cycle (TRIAL is never offered). */
export function PlanGrid({
  plans,
  cycle,
  current,
  action,
}: {
  plans: Plan[];
  cycle: BillingCycle;
  current?: { tier: string; billingCycle: string };
  action?: (plan: Plan, isCurrent: boolean) => ReactNode;
}) {
  // TRIAL is never offered; FREE has no yearly variant, so it shows on both tabs.
  const shown = sortPlans(plans.filter((p) => p.tier !== "TRIAL" && p.isActive && (p.billingCycle === cycle || p.tier === "FREE")));
  if (!shown.length) return <p className="text-sm text-slate-500">No plans available for this billing cycle.</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map((p) => {
        const isCurrent = !!current && current.tier === p.tier && current.billingCycle === p.billingCycle;
        return (
          <div
            key={p.planDefinitionId}
            className={cx(
              "flex flex-col rounded-xl bg-white p-5 ring-1 dark:bg-slate-900",
              isCurrent ? "ring-2 ring-brand-500" : "ring-slate-200 dark:ring-slate-800",
            )}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{humanize(p.tier)}</h3>
              {isCurrent && <Badge tone="blue">Current</Badge>}
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{formatPrice(p.price, p.billingCycle)}</div>
            {p.tier === "FREE" && <div className="text-xs text-slate-500">forever</div>}
            <ul className="mt-4 flex-1 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
              {LIMIT_KEYS.map((k) => (
                <li key={k} className="flex justify-between gap-3">
                  <span>{LIMIT_LABELS[k]}</span>
                  <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                    {k === "monthlyRecordingMinutes" && p[k] === 0 ? "—" : formatLimit(p[k])}
                  </span>
                </li>
              ))}
            </ul>
            {action && <div className="mt-5">{action(p, isCurrent)}</div>}
          </div>
        );
      })}
    </div>
  );
}

/** Usage bar against a plan limit (null limit = unlimited). */
export function UsageMeter({ label, used, limit, unit = "" }: { label: string; used: number; limit: number | null; unit?: string }) {
  if (limit === 0) {
    return (
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-slate-500">Not included in your plan</span>
      </div>
    );
  }
  const pct = limit == null ? 0 : limit === 0 ? 100 : Math.min(100, (used / limit) * 100);
  const tone = limit == null ? "bg-brand-500" : pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-brand-500";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-slate-500">
          {formatNumber(used, 0)}
          {unit} / {limit == null ? "Unlimited" : `${formatNumber(limit, 0)}${unit}`}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={cx("h-full rounded-full transition-all", tone)} style={{ width: `${limit == null ? 0 : Math.max(pct, used > 0 ? 2 : 0)}%` }} />
      </div>
    </div>
  );
}

export function CycleTabs({ value, onChange }: { value: BillingCycle; onChange: (v: BillingCycle) => void }) {
  return (
    <div className="inline-grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-0.5 text-xs font-medium dark:bg-slate-800">
      {(["MONTHLY", "YEARLY"] as const).map((c) => (
        <Button key={c} variant="ghost" size="sm" onClick={() => onChange(c)} className={cx(value === c && "bg-white shadow-sm dark:bg-slate-900")}>
          {c === "MONTHLY" ? "Monthly" : "Yearly"}
        </Button>
      ))}
    </div>
  );
}
