import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usage } from "@/api/rtc";
import { USAGE_TYPES, type UsageType } from "@/api/types";
import { formatDate, formatNumber, humanize, localMidnightIso, startOfMonth, today } from "@/lib/format";
import { useProject } from "./ProjectLayout";
import { Card, Empty, ErrorBox, Input, Loading, Pagination, Select, Stat, Table } from "@/components/ui";

const LIMIT = 25;

const unit: Record<UsageType, string> = {
  VIDEO_MINUTES: "min",
  AUDIO_MINUTES: "min",
  DATA_TRANSFER_MB: "MB",
  RECORDING_STORAGE_MB: "MB",
};

export default function Usage() {
  const project = useProject();
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [type, setType] = useState<UsageType | "">("");
  const [offset, setOffset] = useState(0);

  // Local-day boundaries; `to` is exclusive on the API, so send the midnight after the end date.
  const range = { from: from ? localMidnightIso(from) : undefined, to: to ? localMidnightIso(to, 1) : undefined };

  const summary = useQuery({
    queryKey: ["usage-summary", project.projectId, range],
    queryFn: () => usage.summary(project.projectId, range),
  });
  const records = useQuery({
    queryKey: ["usage", project.projectId, { ...range, type, offset }],
    queryFn: () => usage.list(project.projectId, { ...range, usageType: type || undefined, offset, limit: LIMIT }),
    placeholderData: keepPreviousData,
  });

  const total = (t: UsageType) => summary.data?.totals.find((x) => x.usageType === t);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <Input label="From" type="date" value={from} max={to} onChange={(e) => (setFrom(e.target.value), setOffset(0))} className="w-44" />
        <Input label="To" type="date" value={to} min={from} onChange={(e) => (setTo(e.target.value), setOffset(0))} className="w-44" />
      </div>

      <ErrorBox error={summary.error} onRetry={() => summary.refetch()} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {USAGE_TYPES.map((t) => (
          <Stat
            key={t}
            label={humanize(t)}
            value={summary.isLoading ? "…" : `${formatNumber(total(t)?.totalUsage ?? 0)} ${unit[t]}`}
            hint={`${total(t)?.records ?? 0} records`}
          />
        ))}
      </div>

      <Card
        title="Usage records"
        actions={
          <Select value={type} onChange={(e) => (setType(e.target.value as UsageType | ""), setOffset(0))} className="w-48">
            <option value="">All types</option>
            {USAGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
              </option>
            ))}
          </Select>
        }
      >
        <ErrorBox error={records.error} />
        {records.isLoading ? (
          <Loading />
        ) : records.data?.items.length === 0 ? (
          <Empty title="No usage in this period" description="Minutes are recorded when a user leaves a channel; storage when a recording completes." />
        ) : (
          records.data && (
            <>
              <Table
                rows={records.data.items}
                rowKey={(r) => r.usageRecordId}
                columns={[
                  { header: "Time", className: "whitespace-nowrap", cell: (r) => formatDate(r.recordedAt) },
                  { header: "Type", cell: (r) => humanize(r.usageType) },
                  { header: "Amount", className: "text-right tabular-nums", cell: (r) => `${formatNumber(r.usageValue)} ${unit[r.usageType]}` },
                  { header: "User", cell: (r) => <span className="font-mono text-xs">{r.externalUserId}</span> },
                  {
                    header: "Source",
                    cell: (r) => <span className="text-xs text-slate-500">{r.sourceId ? r.sourceId.split(":")[0] : "manual"}</span>,
                  },
                ]}
              />
              <Pagination offset={offset} limit={LIMIT} total={records.data.total} onChange={setOffset} />
            </>
          )
        )}
      </Card>
    </div>
  );
}
