import { useState } from "react";
import { useNavigate } from "react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { channels } from "@/api/rtc";
import { CHANNEL_TYPES, type Channel, type ChannelType } from "@/api/types";
import { formatDate, humanize, timeAgo } from "@/lib/format";
import { useProject } from "./ProjectLayout";
import { Button, Card, Empty, ErrorBox, Input, Loading, Modal, Pagination, Select, StatusBadge, Table, Tabs, Textarea } from "@/components/ui";

const LIMIT = 20;
const NAME_PATTERN = "[A-Za-z0-9_\\-.:]+";

export default function Channels() {
  const project = useProject();
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "ACTIVE">("all");
  const [editing, setEditing] = useState<Channel | "new" | null>(null);

  const query = useQuery({
    queryKey: ["channels", project.projectId, { offset, search, filter }],
    queryFn: () =>
      channels.list(project.projectId, {
        offset,
        limit: LIMIT,
        search: search || undefined,
        roomStatus: filter === "ACTIVE" ? "ACTIVE" : undefined,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 10_000,
  });

  return (
    <>
      <Card
        title="Channels"
        actions={
          <>
            <Tabs
              value={filter}
              onChange={(v) => {
                setFilter(v);
                setOffset(0);
              }}
              tabs={[
                { value: "all", label: "All" },
                { value: "ACTIVE", label: "Live" },
              ]}
            />
            <Input
              placeholder="Search…"
              className="w-48"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
            />
            <Button size="sm" onClick={() => setEditing("new")}>
              New channel
            </Button>
          </>
        }
      >
        <ErrorBox error={query.error} onRetry={() => query.refetch()} />
        {query.isLoading ? (
          <Loading />
        ) : query.data?.items.length === 0 ? (
          <Empty
            title={filter === "ACTIVE" ? "No live rooms right now" : "No channels yet"}
            description="Channels are created automatically the first time someone joins a channel name. You can also create them here."
          />
        ) : (
          query.data && (
            <>
              <Table
                rows={query.data.items}
                rowKey={(c) => c.channelId}
                onRowClick={(c) => navigate(c.channelId)}
                columns={[
                  { header: "Name", cell: (c) => <span className="font-mono text-xs font-medium">{c.name}</span> },
                  { header: "Type", cell: (c) => humanize(c.type) },
                  {
                    header: "Room",
                    cell: (c) => (
                      <div className="flex items-center gap-2">
                        <StatusBadge status={c.roomStatus} />
                        {c.roomStatus === "ACTIVE" && <span className="text-xs text-slate-500">since {timeAgo(c.roomStartedAt)}</span>}
                      </div>
                    ),
                  },
                  { header: "Node", cell: (c) => <span className="text-xs text-slate-500">{c.activeNodeId ?? "—"}</span> },
                  { header: "Created", className: "whitespace-nowrap", cell: (c) => <span className="text-slate-500">{formatDate(c.createdAt)}</span> },
                ]}
              />
              <Pagination offset={offset} limit={LIMIT} total={query.data.total} onChange={setOffset} />
            </>
          )
        )}
      </Card>
      <ChannelFormModal projectId={project.projectId} channel={editing} onClose={() => setEditing(null)} />
    </>
  );
}

export function ChannelFormModal({ projectId, channel, onClose }: { projectId: string; channel: Channel | "new" | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = channel === "new";
  const existing = channel && channel !== "new" ? channel : null;

  const [name, setName] = useState("");
  const [type, setType] = useState<ChannelType>("VIDEO_CALL");
  const [description, setDescription] = useState("");
  const [initialFor, setInitialFor] = useState<Channel | "new" | null>(null);
  if (channel !== initialFor) {
    // Reset the form whenever a different channel is opened.
    setInitialFor(channel);
    setName(existing?.name ?? "");
    setType(existing?.type ?? "VIDEO_CALL");
    setDescription(existing?.description ?? "");
  }

  const mutation = useMutation({
    mutationFn: () =>
      existing
        ? channels.update(projectId, existing.channelId, { name, type, description: description || null })
        : channels.create(projectId, { name, type, description: description || undefined }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["channels", projectId] });
      qc.setQueryData(["channel", projectId, c.channelId], c);
      onClose();
    },
  });

  return (
    <Modal
      open={!!channel}
      onClose={onClose}
      title={isNew ? "New channel" : "Edit channel"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="channel-form" loading={mutation.isPending}>
            {isNew ? "Create" : "Save"}
          </Button>
        </>
      }
    >
      <form
        id="channel-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <Input
          label="Name"
          required
          maxLength={64}
          pattern={NAME_PATTERN}
          hint="Letters, digits and _ - . : — this is the channelName clients join."
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={existing?.roomStatus === "ACTIVE"}
        />
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value as ChannelType)}>
          {CHANNEL_TYPES.map((t) => (
            <option key={t} value={t}>
              {humanize(t)}
            </option>
          ))}
        </Select>
        <Textarea label="Description" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
        <ErrorBox error={mutation.error} />
      </form>
    </Modal>
  );
}
