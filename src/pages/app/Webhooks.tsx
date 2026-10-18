import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { webhooks } from "@/api/rtc";
import { WEBHOOK_EVENT_TYPES, type WebhookEndpoint, type WebhookEndpointWithSecret, type WebhookEventType } from "@/api/types";
import { formatDate, humanize } from "@/lib/format";
import { useProject } from "./ProjectLayout";
import { Badge, Button, Card, ConfirmModal, Empty, ErrorBox, Input, Loading, Modal, SecretRevealModal, Toggle, cx } from "@/components/ui";

export default function Webhooks() {
  const project = useProject();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<WebhookEndpoint | "new" | null>(null);
  const [revealed, setRevealed] = useState<WebhookEndpointWithSecret | null>(null);
  const [rotating, setRotating] = useState<WebhookEndpoint | null>(null);
  const [deleting, setDeleting] = useState<WebhookEndpoint | null>(null);

  const query = useQuery({
    queryKey: ["webhook-endpoints", project.projectId],
    queryFn: () => webhooks.listEndpoints(project.projectId, { limit: 100 }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["webhook-endpoints", project.projectId] });

  const toggle = useMutation({
    mutationFn: (e: WebhookEndpoint) => webhooks.updateEndpoint(e.webhookEndpointId, { isActive: !e.isActive }),
    onSuccess: invalidate,
  });
  const rotate = useMutation({
    mutationFn: (e: WebhookEndpoint) => webhooks.rotateEndpointSecret(e.webhookEndpointId),
    onSuccess: (e) => {
      setRotating(null);
      setRevealed(e);
      invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (e: WebhookEndpoint) => webhooks.removeEndpoint(e.webhookEndpointId),
    onSuccess: () => {
      setDeleting(null);
      invalidate();
    },
  });

  return (
    <>
      <Card
        title="Webhook endpoints"
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            Add endpoint
          </Button>
        }
      >
        <div className="space-y-3">
          <ErrorBox error={query.error || toggle.error} onRetry={() => query.refetch()} />
          {query.isLoading ? (
            <Loading />
          ) : query.data?.items.length === 0 ? (
            <Empty
              title="No endpoints"
              description="Add a URL to receive signed events when users join, rooms end or recordings finish."
              action={<Button onClick={() => setEditing("new")}>Add endpoint</Button>}
            />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {query.data?.items.map((e) => (
                <li key={e.webhookEndpointId} className="flex flex-wrap items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <code className={cx("font-mono text-sm break-all", !e.isActive && "text-slate-400 line-through")}>{e.url}</code>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {e.eventTypes.map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">Added {formatDate(e.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Toggle checked={e.isActive} disabled={toggle.isPending} onChange={() => toggle.mutate(e)} label={e.isActive ? "Active" : "Paused"} />
                    <Button variant="ghost" size="sm" onClick={() => setEditing(e)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setRotating(e)}>
                      Rotate secret
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDeleting(e)}>
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <EndpointFormModal
        projectId={project.projectId}
        endpoint={editing}
        onClose={() => setEditing(null)}
        onCreated={(e) => {
          setEditing(null);
          setRevealed(e);
          invalidate();
        }}
        onUpdated={() => {
          setEditing(null);
          invalidate();
        }}
      />
      <SecretRevealModal
        open={!!revealed}
        onClose={() => setRevealed(null)}
        title="Webhook signing secret"
        secrets={revealed ? [{ label: "Signing secret", value: revealed.secret }] : []}
        note={
          <p className="text-xs text-slate-500">
            Verify the <code>x-mumu-signature</code> header with this secret. See the quickstart for sample code.
          </p>
        }
      />
      <ConfirmModal
        open={!!rotating}
        onClose={() => setRotating(null)}
        onConfirm={() => rotating && rotate.mutate(rotating)}
        title="Rotate signing secret?"
        message="Deliveries are signed with the new secret right away. Update your receiver before confirming."
        confirmLabel="Rotate"
        loading={rotate.isPending}
        error={rotate.error}
      />
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
        title="Delete endpoint?"
        message={<>Pending deliveries to <code className="break-all">{deleting?.url}</code> are dropped.</>}
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
        error={remove.error}
      />
    </>
  );
}

function EndpointFormModal({
  projectId,
  endpoint,
  onClose,
  onCreated,
  onUpdated,
}: {
  projectId: string;
  endpoint: WebhookEndpoint | "new" | null;
  onClose: () => void;
  onCreated: (e: WebhookEndpointWithSecret) => void;
  onUpdated: () => void;
}) {
  const existing = endpoint && endpoint !== "new" ? endpoint : null;
  const [url, setUrl] = useState("");
  const [types, setTypes] = useState<WebhookEventType[]>([]);
  const [initialFor, setInitialFor] = useState<typeof endpoint>(null);
  if (endpoint !== initialFor) {
    setInitialFor(endpoint);
    setUrl(existing?.url ?? "");
    setTypes(existing?.eventTypes ?? ["USER_JOINED", "USER_LEFT", "SESSION_STARTED", "SESSION_ENDED"]);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (existing) {
        await webhooks.updateEndpoint(existing.webhookEndpointId, { url, eventTypes: types });
        return null;
      }
      return webhooks.createEndpoint(projectId, { url, eventTypes: types });
    },
    onSuccess: (created) => (created ? onCreated(created) : onUpdated()),
  });

  const toggleType = (t: WebhookEventType) => setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <Modal
      open={!!endpoint}
      onClose={onClose}
      title={existing ? "Edit endpoint" : "Add endpoint"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="endpoint-form" loading={mutation.isPending} disabled={types.length === 0}>
            {existing ? "Save" : "Add endpoint"}
          </Button>
        </>
      }
    >
      <form
        id="endpoint-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <Input
          label="URL"
          type="url"
          required
          placeholder="https://example.com/mumu/webhook"
          hint="HTTPS is required in production."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">Events</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {WEBHOOK_EVENT_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 rounded" checked={types.includes(t)} onChange={() => toggleType(t)} />
                {humanize(t)}
              </label>
            ))}
          </div>
        </fieldset>
        <ErrorBox error={mutation.error} />
      </form>
    </Modal>
  );
}
