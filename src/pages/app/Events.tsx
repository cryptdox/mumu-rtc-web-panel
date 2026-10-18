import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { webhooks } from "@/api/rtc";
import { WEBHOOK_EVENT_TYPES, type WebhookEvent, type WebhookEventType } from "@/api/types";
import { formatDate, humanize, timeAgo } from "@/lib/format";
import { useProject } from "./ProjectLayout";
import { Badge, Button, Card, CodeBlock, Empty, ErrorBox, Loading, Modal, Pagination, Select, StatusBadge, Table } from "@/components/ui";

const LIMIT = 25;

export default function Events() {
  const project = useProject();
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [eventType, setEventType] = useState<WebhookEventType | "">("");
  const [delivered, setDelivered] = useState<"" | "true" | "false">("");
  const [open, setOpen] = useState<WebhookEvent | null>(null);
  const [testType, setTestType] = useState<WebhookEventType>("USER_JOINED");

  const query = useQuery({
    queryKey: ["webhook-events", project.projectId, { offset, eventType, delivered }],
    queryFn: () =>
      webhooks.listEvents(project.projectId, {
        offset,
        limit: LIMIT,
        eventType: eventType || undefined,
        delivered: delivered === "" ? undefined : delivered === "true",
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 10_000,
  });

  const test = useMutation({
    mutationFn: () => webhooks.emitTest(project.projectId, testType),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhook-events", project.projectId] }),
  });

  return (
    <div className="space-y-6">
      <Card title="Send a test event">
        <div className="flex flex-wrap items-end gap-3">
          <Select label="Event type" value={testType} onChange={(e) => setTestType(e.target.value as WebhookEventType)} className="w-56">
            {WEBHOOK_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Button loading={test.isPending} onClick={() => test.mutate()}>
            Send test event
          </Button>
          {test.isSuccess && <span className="text-sm text-emerald-600">Queued — it appears below and is delivered within seconds.</span>}
        </div>
        <div className="mt-3">
          <ErrorBox error={test.error} />
        </div>
      </Card>

      <Card
        title="Events"
        actions={
          <>
            <Select value={eventType} onChange={(e) => (setEventType(e.target.value as WebhookEventType | ""), setOffset(0))} className="w-48">
              <option value="">All types</option>
              {WEBHOOK_EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Select value={delivered} onChange={(e) => (setDelivered(e.target.value as "" | "true" | "false"), setOffset(0))} className="w-40">
              <option value="">Any status</option>
              <option value="true">Delivered</option>
              <option value="false">Not delivered</option>
            </Select>
          </>
        }
      >
        <ErrorBox error={query.error} onRetry={() => query.refetch()} />
        {query.isLoading ? (
          <Loading />
        ) : query.data?.items.length === 0 ? (
          <Empty title="No events" description="Events appear here as soon as something happens in your project." />
        ) : (
          query.data && (
            <>
              <Table
                rows={query.data.items}
                rowKey={(e) => e.webhookEventId}
                onRowClick={setOpen}
                columns={[
                  { header: "Event", cell: (e) => <code className="font-mono text-xs font-medium">{e.eventType}</code> },
                  { header: "User", cell: (e) => <span className="font-mono text-xs text-slate-500">{e.externalUserId ?? "—"}</span> },
                  { header: "Delivery", cell: (e) => (e.delivered ? <Badge tone="green">delivered</Badge> : <Badge tone="amber">pending / failed</Badge>) },
                  { header: "When", cell: (e) => <span className="text-slate-500" title={formatDate(e.createdAt)}>{timeAgo(e.createdAt)}</span> },
                ]}
              />
              <Pagination offset={offset} limit={LIMIT} total={query.data.total} onChange={setOffset} />
            </>
          )
        )}
      </Card>

      <EventDetailModal projectId={project.projectId} event={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function EventDetailModal({ projectId, event, onClose }: { projectId: string; event: WebhookEvent | null; onClose: () => void }) {
  const qc = useQueryClient();
  const id = event?.webhookEventId;
  const query = useQuery({
    queryKey: ["webhook-event", projectId, id],
    queryFn: () => webhooks.getEvent(projectId, id!),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.deliveries?.some((d) => d.status === "PENDING") ? 3_000 : false),
  });
  const endpoints = useQuery({
    queryKey: ["webhook-endpoints", projectId],
    queryFn: () => webhooks.listEndpoints(projectId, { limit: 100 }),
    enabled: !!id,
  });
  const urlOf = (endpointId: string) => endpoints.data?.items.find((e) => e.webhookEndpointId === endpointId)?.url ?? endpointId;

  const redeliver = useMutation({
    mutationFn: () => webhooks.redeliver(projectId, id!),
    onSuccess: (e) => {
      qc.setQueryData(["webhook-event", projectId, id], e);
      qc.invalidateQueries({ queryKey: ["webhook-events", projectId] });
    },
  });

  const data = query.data ?? event;
  return (
    <Modal
      open={!!event}
      onClose={onClose}
      wide
      title={data ? humanize(data.eventType) : "Event"}
      footer={
        <Button variant="secondary" loading={redeliver.isPending} onClick={() => redeliver.mutate()}>
          Redeliver
        </Button>
      }
    >
      {data && (
        <>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="text-slate-500">Event id</span> <code className="text-xs">{data.webhookEventId}</code>
            </div>
            <div>
              <span className="text-slate-500">Created</span> {formatDate(data.createdAt)}
            </div>
          </div>
          <CodeBlock language="json" code={JSON.stringify(data.payload, null, 2)} />
          <h4 className="text-sm font-semibold">Deliveries</h4>
          <ErrorBox error={query.error || redeliver.error} />
          {query.isLoading ? (
            <Loading />
          ) : !query.data?.deliveries?.length ? (
            <p className="text-sm text-slate-500">No endpoint was subscribed to this event type when it happened.</p>
          ) : (
            <Table
              rows={query.data.deliveries}
              rowKey={(d) => d.webhookDeliveryId}
              columns={[
                { header: "Endpoint", cell: (d) => <code className="text-xs break-all">{urlOf(d.webhookEndpointId)}</code> },
                { header: "Status", cell: (d) => <StatusBadge status={d.status} /> },
                { header: "Attempts", cell: (d) => d.attempts },
                {
                  header: "Last result",
                  cell: (d) =>
                    d.deliveredAt ? (
                      <span className="text-xs text-slate-500">HTTP {d.lastStatusCode} · {timeAgo(d.deliveredAt)}</span>
                    ) : d.lastError ? (
                      <span className="text-xs text-red-600">
                        {d.lastError}
                        {d.status === "PENDING" && <> · retry {timeAgo(d.nextAttemptAt)}</>}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">queued</span>
                    ),
                },
              ]}
            />
          )}
        </>
      )}
    </Modal>
  );
}
