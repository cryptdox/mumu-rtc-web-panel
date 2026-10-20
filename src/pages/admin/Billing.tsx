import { useState, type ReactNode } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { plans, subscriptionsAdmin, type PlanInput } from "@/api/rtc";
import type { Plan, PlanLimits, PlanTier, RequestStatus, SubscriptionRequest, SubscriptionRow } from "@/api/types";
import { useAuth } from "@/lib/auth";
import { formatDate, formatNumber, timeAgo } from "@/lib/format";
import { formatLimit, formatPrice, LIMIT_KEYS, LIMIT_LABELS, neverExpires, planName, sortPlans, TIER_ORDER, UsageMeter } from "@/components/plans";
import { HistoryTable } from "@/pages/app/Billing";
import {
  Badge,
  Button,
  Card,
  ConfirmModal,
  Empty,
  ErrorBox,
  Input,
  Loading,
  Modal,
  Notice,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  Table,
  Tabs,
  Toggle,
} from "@/components/ui";

const LIMIT = 25;

// ── Plans catalog ───────────────────────────────────────────────────────────

export function AdminPlans() {
  const { can } = useAuth();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [logsFor, setLogsFor] = useState<Plan | null>(null);
  const query = useQuery({ queryKey: ["plans", "all"], queryFn: plans.listAll });

  return (
    <>
      <PageHeader
        title="Plans"
        description="The subscription catalog. Edits apply to new assignments and approvals; existing subscriptions keep the limits they were given."
      />
      <Card title={query.data ? `${query.data.length} plans` : "Plans"}>
        <ErrorBox error={query.error} onRetry={() => query.refetch()} />
        {query.isLoading ? (
          <Loading />
        ) : (
          <Table
            rows={sortPlans(query.data ?? [])}
            rowKey={(p) => p.planDefinitionId}
            columns={[
              { header: "Plan", cell: (p) => <span className="font-medium">{planName(p)}</span> },
              { header: "Price", className: "whitespace-nowrap tabular-nums", cell: (p) => formatPrice(p.price, p.billingCycle) },
              ...LIMIT_KEYS.map((k) => ({ header: LIMIT_LABELS[k], className: "tabular-nums", cell: (p: Plan) => formatLimit(p[k]) })),
              { header: "Status", cell: (p) => (p.isActive ? <Badge tone="green">active</Badge> : <Badge>inactive</Badge>) },
              {
                header: "",
                className: "text-right whitespace-nowrap",
                cell: (p) => (
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setLogsFor(p)}>
                      History
                    </Button>
                    {can("RTC_PLAN", "UPDATE") && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                        Edit
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>
      <EditPlanModal plan={editing} onClose={() => setEditing(null)} />
      <PlanLogsModal plan={logsFor} onClose={() => setLogsFor(null)} />
    </>
  );
}

/** "" in a limit field = unlimited (null). */
const toLimit = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.floor(Number(v))));

function EditPlanModal({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [active, setActive] = useState(true);
  const [seeded, setSeeded] = useState<string | null>(null);

  if (plan && seeded !== plan.planDefinitionId) {
    setSeeded(plan.planDefinitionId);
    setForm({
      ...Object.fromEntries(LIMIT_KEYS.map((k) => [k, plan[k] == null ? "" : String(plan[k])])),
      price: plan.price == null ? "" : String(plan.price),
    });
    setActive(plan.isActive);
  }

  const mutation = useMutation({
    mutationFn: () => {
      const body: PlanInput = { isActive: active, price: form.price.trim() === "" ? null : Number(form.price) };
      for (const k of LIMIT_KEYS) (body as Record<keyof PlanLimits, number | null>)[k] = toLimit(form[k]);
      return plans.update(plan!.planDefinitionId, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      close();
    },
  });
  const close = () => {
    mutation.reset();
    setSeeded(null);
    onClose();
  };

  return (
    <Modal
      open={!!plan}
      onClose={close}
      title={plan ? `Edit ${planName(plan)}` : ""}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button form="edit-plan" type="submit" loading={mutation.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="edit-plan"
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        {LIMIT_KEYS.map((k) => (
          <Input
            key={k}
            label={LIMIT_LABELS[k]}
            type="number"
            min={0}
            placeholder="Unlimited"
            value={form[k] ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
          />
        ))}
        <Input
          label={`Price (${plan?.billingCycle === "YEARLY" ? "per year" : "per month"}, USD)`}
          type="number"
          min={0}
          step="0.01"
          placeholder="Contact us"
          value={form.price ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
        />
        <div className="sm:col-span-2">
          <Toggle checked={active} onChange={setActive} label="Offered to developers" />
        </div>
        <p className="text-xs text-slate-500 sm:col-span-2">Leave a field empty for unlimited (or "contact us" for price). Recording minutes 0 = recording not included.</p>
        <div className="sm:col-span-2">
          <ErrorBox error={mutation.error} />
        </div>
      </form>
    </Modal>
  );
}

function PlanLogsModal({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const logs = useQuery({ queryKey: ["plans", "logs", plan?.planDefinitionId], queryFn: () => plans.logs(plan!.planDefinitionId), enabled: !!plan });
  return (
    <Modal open={!!plan} onClose={onClose} title={plan ? `${planName(plan)} — history` : ""} wide>
      <ErrorBox error={logs.error} />
      {logs.isLoading ? (
        <Loading />
      ) : logs.data?.length ? (
        <ul className="space-y-3 text-sm">
          {logs.data.map((l) => (
            <li key={l.planDefinitionLogId} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <Badge tone={l.action === "DEACTIVATED" ? "red" : l.action === "CREATED" ? "blue" : "green"}>{l.action.toLowerCase()}</Badge>
                <span className="text-xs text-slate-500">
                  {formatDate(l.createdAt)}
                  {l.performedByUserId && ` · ${l.performedByUserId}`}
                </span>
              </div>
              {l.action !== "CREATED" && l.changes && (
                <ul className="mt-2 space-y-0.5 text-xs">
                  {Object.entries(l.changes as Record<string, { from: unknown; to: unknown }>).map(([k, v]) => (
                    <li key={k}>
                      <span className="font-medium">{LIMIT_LABELS[k as keyof PlanLimits] ?? k}</span>: {String(v.from ?? "unlimited")} → {String(v.to ?? "unlimited")}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="No changes recorded" />
      )}
    </Modal>
  );
}

// ── Plan requests ───────────────────────────────────────────────────────────

export function AdminRequests() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const [status, setStatus] = useState<RequestStatus>("PENDING");
  const [offset, setOffset] = useState(0);
  const [pending, setPending] = useState<{ request: SubscriptionRequest; action: "approve" | "reject" } | null>(null);

  const query = useQuery({
    queryKey: ["subscription-requests", { status, offset }],
    queryFn: () => subscriptionsAdmin.requests({ status, offset, limit: LIMIT, sortOrder: status === "PENDING" ? "asc" : "desc" }),
    placeholderData: keepPreviousData,
  });

  const act = useMutation({
    mutationFn: async ({ request, action }: { request: SubscriptionRequest; action: "approve" | "reject" }) => {
      if (action === "approve") await subscriptionsAdmin.approve(request.subscriptionRequestId);
      else await subscriptionsAdmin.reject(request.subscriptionRequestId);
    },
    onSuccess: () => {
      setPending(null);
      qc.invalidateQueries({ queryKey: ["subscription-requests"] });
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
    },
  });

  return (
    <>
      <PageHeader title="Plan requests" description="Developers ask for upgrades, downgrades and renewals here. Approving applies the plan immediately at the quoted price." />
      <Card
        title={
          <Tabs
            value={status}
            onChange={(v) => (setStatus(v), setOffset(0))}
            tabs={[
              { value: "PENDING", label: "Pending" },
              { value: "APPROVED", label: "Approved" },
              { value: "REJECTED", label: "Rejected" },
            ]}
          />
        }
      >
        <ErrorBox error={query.error} onRetry={() => query.refetch()} />
        {query.isLoading ? (
          <Loading />
        ) : !query.data?.items.length ? (
          <Empty title={status === "PENDING" ? "Nothing waiting for review" : `No ${status.toLowerCase()} requests`} />
        ) : (
          <>
            <RequestsTableWithUser
              rows={query.data.items}
              actions={
                status === "PENDING" && can("RTC_SUBSCRIPTION", "UPDATE")
                  ? (r) => (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" onClick={() => setPending({ request: r, action: "approve" })}>
                          Approve
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setPending({ request: r, action: "reject" })}>
                          Reject
                        </Button>
                      </div>
                    )
                  : undefined
              }
            />
            <Pagination offset={offset} limit={LIMIT} total={query.data.total} onChange={setOffset} />
          </>
        )}
      </Card>
      {pending && (
        <ConfirmModal
          open
          onClose={() => setPending(null)}
          onConfirm={() => act.mutate(pending)}
          title={pending.action === "approve" ? "Approve plan change?" : "Reject request?"}
          message={
            <>
              <p>
                <code className="text-xs">{pending.request.userId}</code> →{" "}
                <b>{pending.request.requestedPlan ? planName(pending.request.requestedPlan) : "plan"}</b> × {pending.request.requestedCycleCount}
              </p>
              {pending.action === "approve" && (
                <p className="mt-2">
                  Charges the quoted {pending.request.calculatedPrice == null ? "custom price" : formatPrice(pending.request.calculatedPrice)} and applies the
                  plan now.
                </p>
              )}
            </>
          }
          confirmLabel={pending.action === "approve" ? "Approve" : "Reject"}
          danger={pending.action === "reject"}
          loading={act.isPending}
          error={act.error}
        />
      )}
    </>
  );
}

/** Admin view of requests: the developer's user id first, then the request. */
function RequestsTableWithUser({ rows, actions }: { rows: SubscriptionRequest[]; actions?: (r: SubscriptionRequest) => ReactNode }) {
  return (
    <Table
      rows={rows}
      rowKey={(r) => r.subscriptionRequestId}
      columns={[
        { header: "Developer", cell: (r) => <code className="text-xs">{r.userId}</code> },
        { header: "Plan", cell: (r) => (r.requestedPlan ? planName(r.requestedPlan) : "—") },
        { header: "Cycles", className: "tabular-nums", cell: (r) => `${r.requestedCycleCount}${r.isRenewal ? " · renewal" : ""}` },
        { header: "Quoted", className: "tabular-nums", cell: (r) => (r.calculatedPrice == null ? "custom" : formatPrice(r.calculatedPrice)) },
        { header: "Requested", cell: (r) => <span className="whitespace-nowrap text-xs text-slate-500">{formatDate(r.createdAt)}</span> },
        ...(actions ? [{ header: "", className: "text-right whitespace-nowrap", cell: actions }] : []),
      ]}
    />
  );
}

// ── Subscriptions ───────────────────────────────────────────────────────────

export function AdminSubscriptions() {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<PlanTier | "">("");
  const [expired, setExpired] = useState<"" | "true" | "false">("");
  const [open, setOpen] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["subscriptions", { offset, search, tier, expired }],
    queryFn: () =>
      subscriptionsAdmin.list({
        offset,
        limit: LIMIT,
        search: search || undefined,
        tier: tier || undefined,
        expired: expired === "" ? undefined : expired === "true",
        sortOrder: "asc",
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Subscriptions" description="Every developer's plan. Sorted by expiry, soonest first." />
      <Card
        title={query.data ? `${query.data.total} subscription${query.data.total === 1 ? "" : "s"}` : "Subscriptions"}
        actions={
          <>
            <Input placeholder="User id…" value={search} onChange={(e) => (setSearch(e.target.value), setOffset(0))} className="w-56" />
            <Select value={tier} onChange={(e) => (setTier(e.target.value as PlanTier | ""), setOffset(0))} className="w-36">
              <option value="">Any plan</option>
              {TIER_ORDER.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
            <Select value={expired} onChange={(e) => (setExpired(e.target.value as "" | "true" | "false"), setOffset(0))} className="w-32">
              <option value="">Any status</option>
              <option value="false">Active</option>
              <option value="true">Expired</option>
            </Select>
          </>
        }
      >
        <ErrorBox error={query.error} onRetry={() => query.refetch()} />
        {query.isLoading ? (
          <Loading />
        ) : !query.data?.items.length ? (
          <Empty title="No subscriptions" description="A developer gets a trial subscription the first time they use the console or API." />
        ) : (
          <>
            <Table
              rows={query.data.items}
              rowKey={(s) => s.userId}
              onRowClick={(s) => setOpen(s.userId)}
              columns={[
                { header: "Developer", cell: (s) => <code className="text-xs">{s.userId}</code> },
                { header: "Plan", cell: (s) => planName(s.currentPlan) },
                {
                  header: "Expires",
                  cell: (s) => (
                    <span className="whitespace-nowrap text-xs" title={formatDate(s.expiresAt)}>
                      {neverExpires(s.expiresAt) ? "never" : timeAgo(s.expiresAt)}
                    </span>
                  ),
                },
                { header: "Status", cell: (s: SubscriptionRow) => (s.isExpired ? <Badge tone="red">expired</Badge> : <StatusBadge status="ACTIVE" />) },
                { header: "Paid", className: "tabular-nums", cell: (s) => (s.paidAmount == null ? "—" : formatPrice(s.paidAmount)) },
              ]}
            />
            <Pagination offset={offset} limit={LIMIT} total={query.data.total} onChange={setOffset} />
          </>
        )}
      </Card>
      <SubscriptionDetail userId={open} onClose={() => setOpen(null)} />
    </>
  );
}

function SubscriptionDetail({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { can } = useAuth();
  const enabled = !!userId;
  const overview = useQuery({ queryKey: ["subscriptions", "one", userId], queryFn: () => subscriptionsAdmin.get(userId!), enabled });
  const history = useQuery({ queryKey: ["subscriptions", "history", userId], queryFn: () => subscriptionsAdmin.history(userId!), enabled });
  const catalog = useQuery({ queryKey: ["plans", "all"], queryFn: plans.listAll, enabled });

  const [planId, setPlanId] = useState("");
  const [count, setCount] = useState(1);
  const [activeTo, setActiveTo] = useState("");
  const assign = useMutation({
    mutationFn: () =>
      subscriptionsAdmin.assign(userId!, {
        planDefinitionId: planId,
        count,
        ...(activeTo && { activeTo: new Date(activeTo).toISOString() }),
      }),
    onSuccess: () => {
      setPlanId("");
      setActiveTo("");
      setCount(1);
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
    },
  });
  const close = () => {
    assign.reset();
    onClose();
  };

  const sub = overview.data;
  const selected = catalog.data?.find((p) => p.planDefinitionId === planId);

  return (
    <Modal open={enabled} onClose={close} title={<code className="text-xs">{userId}</code>} wide>
      <ErrorBox error={overview.error} />
      {overview.isLoading || !sub ? (
        <Loading />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-lg font-semibold">{planName(sub.plan)}</span>
            {sub.isExpired ? (
              <Badge tone="red">expired {timeAgo(sub.expiresAt)}</Badge>
            ) : neverExpires(sub.expiresAt) ? (
              <Badge tone="green">never expires</Badge>
            ) : (
              <Badge tone="green">until {formatDate(sub.expiresAt)}</Badge>
            )}
            {sub.paidAmount != null && <span className="text-sm text-slate-500">paid {formatPrice(sub.paidAmount)}</span>}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <UsageMeter label="Minutes" used={sub.usage.minutes} limit={sub.plan.monthlyMinutes} />
            <UsageMeter label="Recording" used={sub.usage.recordingMinutes} limit={sub.plan.monthlyRecordingMinutes} />
            <UsageMeter label="Projects" used={sub.usage.projects} limit={sub.plan.maxProjects} />
          </div>
          {sub.pendingRequest && (
            <Notice>
              Pending request: {sub.pendingRequest.requestedPlan ? planName(sub.pendingRequest.requestedPlan) : "plan"} × {sub.pendingRequest.requestedCycleCount}{" "}
              — review it under Plan requests.
            </Notice>
          )}

          {can("RTC_SUBSCRIPTION", "UPDATE") && (
            <form
              className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50"
              onSubmit={(e) => {
                e.preventDefault();
                assign.mutate();
              }}
            >
              <h4 className="text-sm font-semibold">Assign a plan</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <Select label="Plan" required value={planId} onChange={(e) => setPlanId(e.target.value)}>
                  <option value="">Choose…</option>
                  {sortPlans((catalog.data ?? []).filter((p) => p.tier !== "TRIAL")).map((p) => (
                    <option key={p.planDefinitionId} value={p.planDefinitionId}>
                      {planName(p)} — {formatPrice(p.price, p.billingCycle)}
                      {p.isActive ? "" : " (inactive)"}
                    </option>
                  ))}
                </Select>
                <Input label="Cycles" type="number" min={1} max={36} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} />
                <Input
                  label="Expires on (optional)"
                  type="date"
                  value={activeTo}
                  onChange={(e) => setActiveTo(e.target.value)}
                  hint={selected?.price == null && selected ? "Required for custom-price plans" : "Overrides the computed duration"}
                />
              </div>
              <ErrorBox error={assign.error} />
              {assign.isSuccess && <Notice tone="green">Plan assigned.</Notice>}
              <div className="flex justify-end">
                <Button type="submit" loading={assign.isPending} disabled={!planId}>
                  Assign
                </Button>
              </div>
            </form>
          )}

          <div>
            <h4 className="mb-2 text-sm font-semibold">History</h4>
            <ErrorBox error={history.error} />
            {history.data?.length ? <HistoryTable rows={history.data} /> : <p className="text-sm text-slate-500">No history.</p>}
          </div>
          <p className="text-xs text-slate-500">
            Period {formatDate(sub.period.start).split(",")[0]} – {formatDate(sub.period.end).split(",")[0]} · {formatNumber(sub.usage.videoMinutes, 0)} video ·{" "}
            {formatNumber(sub.usage.audioMinutes, 0)} audio minutes
          </p>
        </>
      )}
    </Modal>
  );
}
