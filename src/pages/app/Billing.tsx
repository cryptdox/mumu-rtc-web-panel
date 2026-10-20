import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { plans, subscription } from "@/api/rtc";
import type { BillingCycle, Plan, SubscriptionLog, SubscriptionRequest } from "@/api/types";
import { useAuth } from "@/lib/auth";
import { formatDate, formatNumber, timeAgo } from "@/lib/format";
import { CycleTabs, formatLimit, formatPrice, neverExpires, PlanGrid, planName, UsageMeter } from "@/components/plans";
import { Badge, Button, Card, Empty, ErrorBox, Loading, Modal, Notice, PageHeader, Select, Stat, StatusBadge, Table } from "@/components/ui";

/** The developer's plan, limits, usage this period and plan-change requests. */
export default function Billing() {
  const { can } = useAuth();
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  const [choosing, setChoosing] = useState<Plan | null>(null);

  const me = useQuery({ queryKey: ["subscription", "me"], queryFn: subscription.me });
  const catalog = useQuery({ queryKey: ["plans", "public"], queryFn: plans.listPublic, staleTime: 300_000 });
  const requests = useQuery({ queryKey: ["subscription", "requests"], queryFn: subscription.requests });
  const usage = useQuery({ queryKey: ["subscription", "usage"], queryFn: subscription.usage });
  const history = useQuery({ queryKey: ["subscription", "history"], queryFn: subscription.history });

  if (me.isLoading) return <Loading />;
  if (me.error || !me.data) return <ErrorBox error={me.error} onRetry={() => me.refetch()} />;

  const sub = me.data;
  const plan = sub.plan;
  const pending = sub.pendingRequest;
  const canRequest = can("RTC_SUBSCRIPTION", "CREATE");

  return (
    <>
      <PageHeader title="Billing & plan" description="Your plan applies to all of your projects. Plan changes are reviewed by the MUMU RTC team." />

      {sub.isExpired && (
        <div className="mb-4">
          <Notice tone="amber">
            Your {planName(plan)} plan expired {timeAgo(sub.expiresAt)}. New tokens and joins are blocked until you renew or upgrade — calls already
            running are not affected.
          </Notice>
        </div>
      )}
      {pending && (
        <div className="mb-4">
          <Notice>
            Requested <b>{pending.requestedPlan ? planName(pending.requestedPlan) : "a plan change"}</b>
            {pending.requestedCycleCount > 1 && ` × ${pending.requestedCycleCount}`} on {formatDate(pending.createdAt)} — waiting for approval.
            {pending.calculatedPrice != null && <> Quoted: {formatPrice(pending.calculatedPrice)}.</>}
          </Notice>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Current plan" value={planName(plan)} hint={formatPrice(plan.price, plan.billingCycle)} />
        {neverExpires(sub.expiresAt) ? (
          <Stat label="Expires" value="Never" hint="Free plan" />
        ) : (
          <Stat
            label={sub.isExpired ? "Expired" : plan.tier === "TRIAL" ? "Trial ends" : "Renews / expires"}
            value={formatDate(sub.expiresAt).split(",")[0]}
            hint={sub.isExpired ? <Badge tone="red">expired</Badge> : plan.tier === "TRIAL" ? `${timeAgo(sub.expiresAt)} — then Free` : timeAgo(sub.expiresAt)}
          />
        )}
        <Stat label="Usage resets" value={formatDate(sub.period.end).split(",")[0]} hint={`period started ${formatDate(sub.period.start).split(",")[0]}`} />
      </div>

      <Card title="Usage this period" className="mt-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <UsageMeter label="Minutes (audio + video)" used={sub.usage.minutes} limit={plan.monthlyMinutes} />
          <UsageMeter label="Recording minutes" used={sub.usage.recordingMinutes} limit={plan.monthlyRecordingMinutes} />
          <UsageMeter label="Projects" used={sub.usage.projects} limit={plan.maxProjects} />
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Channels per project</span>
              <span className="tabular-nums text-slate-500">{formatLimit(plan.maxChannelsPerProject)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Participants per channel</span>
              <span className="tabular-nums text-slate-500">{formatLimit(plan.maxConcurrentPeersPerChannel)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Video · audio minutes</span>
              <span className="tabular-nums">
                {formatNumber(sub.usage.videoMinutes, 0)} · {formatNumber(sub.usage.audioMinutes, 0)}
              </span>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Over a limit, new projects, channels, tokens or joins are refused; nothing you already have is removed and running calls continue.
        </p>
      </Card>

      <Card title="Change plan" className="mt-6" actions={<CycleTabs value={cycle} onChange={setCycle} />}>
        <ErrorBox error={catalog.error} onRetry={() => catalog.refetch()} />
        {catalog.isLoading ? (
          <Loading />
        ) : (
          <PlanGrid
            plans={catalog.data ?? []}
            cycle={cycle}
            current={plan}
            action={(p, isCurrent) => (
              <Button
                className="w-full"
                variant={isCurrent ? "secondary" : "primary"}
                disabled={!canRequest || !!pending || (isCurrent && p.tier === "FREE")}
                title={!canRequest ? "Your role can't request plan changes" : pending ? "A request is already pending" : undefined}
                onClick={() => setChoosing(p)}
              >
                {p.tier === "FREE" ? (isCurrent ? "Current plan" : "Switch to Free") : isCurrent ? "Renew" : p.price == null ? "Contact sales" : "Request"}
              </Button>
            )}
          />
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Requests">
          <ErrorBox error={requests.error} />
          {requests.data?.length ? <RequestsTable rows={requests.data} /> : <Empty title="No requests yet" />}
        </Card>
        <Card title="Usage by period">
          <ErrorBox error={usage.error} />
          {usage.data?.length ? (
            <Table
              rows={usage.data}
              rowKey={(u) => u.subscriptionUsageId}
              columns={[
                { header: "Period", cell: (u) => <span className="whitespace-nowrap text-xs">{formatDate(u.periodStart).split(",")[0]} – {formatDate(u.periodEnd).split(",")[0]}</span> },
                { header: "Minutes", className: "tabular-nums", cell: (u) => formatNumber(u.videoMinutes + u.audioMinutes, 0) },
                { header: "Recording", className: "tabular-nums", cell: (u) => formatNumber(u.recordingMinutes, 0) },
              ]}
            />
          ) : (
            <Empty title="No usage recorded yet" />
          )}
        </Card>
      </div>

      <Card title="Plan history" className="mt-6">
        <ErrorBox error={history.error} />
        {history.data?.length ? <HistoryTable rows={history.data} /> : <Empty title="No history yet" />}
      </Card>

      <RequestModal plan={choosing} isRenewal={!!choosing && choosing.tier === plan.tier && choosing.billingCycle === plan.billingCycle} onClose={() => setChoosing(null)} />
    </>
  );
}

function RequestModal({ plan, isRenewal, onClose }: { plan: Plan | null; isRenewal: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [count, setCount] = useState(1);
  const mutation = useMutation({
    mutationFn: () => subscription.request(plan!.planDefinitionId, count),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscription"] }),
  });
  const close = () => {
    mutation.reset();
    setCount(1);
    onClose();
  };
  const unit = plan?.billingCycle === "YEARLY" ? "year" : "month";

  return (
    <Modal
      open={!!plan}
      onClose={close}
      title={plan ? `${isRenewal ? "Renew" : "Request"} ${planName(plan)}` : ""}
      footer={
        mutation.isSuccess ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>
              Send request
            </Button>
          </>
        )
      }
    >
      {plan && !mutation.isSuccess && (
        <>
          <Select label="Duration" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[1, 2, 3, 6, 12].map((n) => (
              <option key={n} value={n}>
                {n} {unit}
                {n > 1 ? "s" : ""}
              </option>
            ))}
          </Select>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            List price: <b>{plan.price == null ? "custom — our team will contact you" : formatPrice(plan.price * count)}</b>.{" "}
            {isRenewal
              ? "A renewal extends your current expiry."
              : "A plan change starts a new period when approved; unused time on your current plan is credited as extra days."}
          </p>
          <ErrorBox error={mutation.error} />
        </>
      )}
      {mutation.data && (
        <Notice tone="green">
          Request sent. Quoted price: <b>{mutation.data.calculatedPrice == null ? "custom" : formatPrice(mutation.data.calculatedPrice)}</b>
          {mutation.data.resolvedDurationDays != null && <> for {mutation.data.resolvedDurationDays} days</>}. You'll get the new limits as soon as it's approved.
        </Notice>
      )}
    </Modal>
  );
}

export function RequestsTable({ rows, actions }: { rows: SubscriptionRequest[]; actions?: (r: SubscriptionRequest) => ReactNode }) {
  return (
    <Table
      rows={rows}
      rowKey={(r) => r.subscriptionRequestId}
      columns={[
        { header: "Plan", cell: (r) => (r.requestedPlan ? planName(r.requestedPlan) : "—") },
        { header: "Cycles", className: "tabular-nums", cell: (r) => `${r.requestedCycleCount}${r.isRenewal ? " · renewal" : ""}` },
        { header: "Quoted", className: "tabular-nums", cell: (r) => (r.calculatedPrice == null ? "custom" : formatPrice(r.calculatedPrice)) },
        { header: "Status", cell: (r) => <StatusBadge status={r.status === "APPROVED" ? "ACTIVE" : r.status === "REJECTED" ? "FAILED" : "PENDING"} /> },
        { header: "Requested", cell: (r) => <span className="whitespace-nowrap text-xs text-slate-500">{formatDate(r.createdAt)}</span> },
        ...(actions ? [{ header: "", className: "text-right whitespace-nowrap", cell: actions }] : []),
      ]}
    />
  );
}

export function HistoryTable({ rows }: { rows: SubscriptionLog[] }) {
  const tone = { ASSIGNED: "blue", REQUESTED: "amber", APPROVED: "green", REJECTED: "red", UPDATED: "blue" } as const;
  return (
    <Table
      rows={rows}
      rowKey={(l) => l.subscriptionLogId}
      columns={[
        { header: "When", cell: (l) => <span className="whitespace-nowrap text-xs text-slate-500">{formatDate(l.createdAt)}</span> },
        { header: "Action", cell: (l) => <Badge tone={tone[l.action]}>{l.action.toLowerCase()}</Badge> },
        {
          header: "Change",
          cell: (l) => (
            <span className="text-sm">
              {l.fromSnapshot ? planName(l.fromSnapshot) : "—"} → {l.toSnapshot ? planName(l.toSnapshot) : "—"}
            </span>
          ),
        },
        {
          header: "Expires",
          cell: (l) => <span className="whitespace-nowrap text-xs">{l.toExpiresAt && neverExpires(l.toExpiresAt) ? "Never" : formatDate(l.toExpiresAt)}</span>,
        },
      ]}
    />
  );
}
