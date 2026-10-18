import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { channels, recordings, sessions } from "@/api/rtc";
import type { RtcSession } from "@/api/types";
import { formatDate, formatDuration, formatNumber, humanize, timeAgo } from "@/lib/format";
import { useProject } from "./ProjectLayout";
import { ChannelFormModal } from "./Channels";
import { Button, Card, ConfirmModal, Empty, ErrorBox, Loading, Modal, Pagination, Stat, StatusBadge, Table, Tabs } from "@/components/ui";

const LIMIT = 20;

export default function ChannelDetail() {
  const project = useProject();
  const { channelId = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const channelQ = useQuery({
    queryKey: ["channel", project.projectId, channelId],
    queryFn: () => channels.get(project.projectId, channelId),
    refetchInterval: 5_000,
  });

  const remove = useMutation({
    mutationFn: () => channels.remove(project.projectId, channelId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels", project.projectId] });
      navigate("..", { relative: "path", replace: true });
    },
  });

  if (channelQ.isLoading) return <Loading />;
  if (!channelQ.data) return <ErrorBox error={channelQ.error ?? new Error("Channel not found")} onRetry={() => channelQ.refetch()} />;
  const channel = channelQ.data;
  const live = channel.roomStatus === "ACTIVE";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to=".." relative="path" className="text-xs text-slate-500 hover:text-slate-700">
            ← Channels
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <h2 className="font-mono text-lg font-semibold">{channel.name}</h2>
            <StatusBadge status={channel.roomStatus} />
          </div>
          {channel.description && <p className="mt-1 text-sm text-slate-500">{channel.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="danger" disabled={live} title={live ? "Can't delete while live" : undefined} onClick={() => setDeleting(true)}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Type" value={<span className="text-base">{humanize(channel.type)}</span>} />
        <Stat label="Live since" value={<span className="text-base">{live ? timeAgo(channel.roomStartedAt) : "—"}</span>} />
        <Stat label="Media node" value={<span className="text-base">{channel.activeNodeId ?? "—"}</span>} />
      </div>

      <SessionsCard channelId={channelId} live={live} />
      <RecordingsCard channelId={channelId} live={live} />

      <ChannelFormModal projectId={project.projectId} channel={editing ? channel : null} onClose={() => setEditing(false)} />
      <ConfirmModal
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => remove.mutate()}
        title="Delete channel?"
        message="Its session history and recordings are deleted too. Usage records are kept."
        confirmText={channel.name}
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
        error={remove.error}
      />
    </div>
  );
}

/** Re-render every `ms` so live durations keep counting between refetches. */
function useNow(ms: number, enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
  return now;
}

function SessionsCard({ channelId, live }: { channelId: string; live: boolean }) {
  const [mode, setMode] = useState<"active" | "all">("active");
  const [offset, setOffset] = useState(0);
  const [statsFor, setStatsFor] = useState<RtcSession | null>(null);
  const now = useNow(1000, live && mode === "active");

  const query = useQuery({
    queryKey: ["sessions", channelId, { mode, offset }],
    queryFn: () => sessions.listByChannel(channelId, { active: mode === "active", offset, limit: LIMIT }),
    placeholderData: keepPreviousData,
    refetchInterval: live ? 5_000 : false,
  });

  return (
    <Card
      title={mode === "active" ? `Connected users${query.data ? ` (${query.data.total})` : ""}` : "Session history"}
      actions={
        <Tabs
          value={mode}
          onChange={(v) => {
            setMode(v);
            setOffset(0);
          }}
          tabs={[
            { value: "active", label: "Connected" },
            { value: "all", label: "History" },
          ]}
        />
      }
    >
      <ErrorBox error={query.error} onRetry={() => query.refetch()} />
      {query.isLoading ? (
        <Loading />
      ) : query.data?.items.length === 0 ? (
        <Empty title={mode === "active" ? "Nobody is connected" : "No sessions yet"} />
      ) : (
        query.data && (
          <>
            <Table
              rows={query.data.items}
              rowKey={(s) => s.rtcSessionId}
              onRowClick={setStatsFor}
              columns={[
                { header: "User", cell: (s) => <span className="font-mono text-xs">{s.externalUserId}</span> },
                { header: "Role", cell: (s) => humanize(s.role) },
                { header: "Joined", className: "whitespace-nowrap", cell: (s) => formatDate(s.joinTime) },
                {
                  header: mode === "active" ? "Connected for" : "Duration",
                  cell: (s) =>
                    s.leaveTime ? formatDuration(s.durationSeconds) : formatDuration(Math.round((now - new Date(s.joinTime).getTime()) / 1000)),
                },
                { header: "Node", cell: (s) => <span className="text-xs text-slate-500">{s.nodeId ?? "—"}</span> },
              ]}
            />
            <Pagination offset={offset} limit={LIMIT} total={query.data.total} onChange={setOffset} />
          </>
        )
      )}
      <SessionStatsModal session={statsFor} onClose={() => setStatsFor(null)} />
    </Card>
  );
}

function SessionStatsModal({ session, onClose }: { session: RtcSession | null; onClose: () => void }) {
  const query = useQuery({
    queryKey: ["media-stats", session?.rtcSessionId],
    queryFn: () => sessions.stats(session!.rtcSessionId, { limit: 50 }),
    enabled: !!session,
  });
  return (
    <Modal open={!!session} onClose={onClose} title={`Media stats · ${session?.externalUserId ?? ""}`} wide>
      <ErrorBox error={query.error} />
      {query.isLoading ? (
        <Loading />
      ) : query.data?.items.length === 0 ? (
        <Empty title="No stats reported for this session" />
      ) : (
        query.data && (
          <Table
            rows={query.data.items}
            rowKey={(m) => m.mediaStatId}
            columns={[
              { header: "Time", className: "whitespace-nowrap", cell: (m) => formatDate(m.recordedAt) },
              { header: "Bitrate", cell: (m) => (m.bitrate != null ? `${formatNumber(m.bitrate / 1000, 0)} kbps` : "—") },
              { header: "Packet loss", cell: (m) => (m.packetLoss != null ? `${formatNumber(m.packetLoss * 100, 1)}%` : "—") },
              { header: "Latency", cell: (m) => (m.latencyMs != null ? `${m.latencyMs} ms` : "—") },
              { header: "Resolution", cell: (m) => m.resolution ?? "—" },
            ]}
          />
        )
      )}
    </Modal>
  );
}

function RecordingsCard({ channelId, live }: { channelId: string; live: boolean }) {
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);

  const query = useQuery({
    queryKey: ["recordings", channelId, { offset }],
    queryFn: () => recordings.listByChannel(channelId, { offset, limit: LIMIT }),
    placeholderData: keepPreviousData,
    refetchInterval: (q) =>
      q.state.data?.items.some((r) => ["PENDING_START", "STARTED", "STOPPING"].includes(r.status)) ? 3_000 : false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["recordings", channelId] });
  const start = useMutation({ mutationFn: () => recordings.start(channelId), onSettled: invalidate });
  const stop = useMutation({ mutationFn: (id: string) => recordings.stop(id), onSettled: invalidate });

  const running = query.data?.items.find((r) => r.status === "PENDING_START" || r.status === "STARTED");

  return (
    <Card
      title="Recordings"
      actions={
        running ? (
          <Button variant="danger" size="sm" loading={stop.isPending} onClick={() => stop.mutate(running.recordingJobId)}>
            ■ Stop recording
          </Button>
        ) : (
          <Button size="sm" disabled={!live} title={live ? undefined : "The channel must be live"} loading={start.isPending} onClick={() => start.mutate()}>
            ● Start recording
          </Button>
        )
      }
    >
      <div className="space-y-3">
        <ErrorBox error={start.error || stop.error || query.error} />
        {query.isLoading ? (
          <Loading />
        ) : query.data?.items.length === 0 ? (
          <Empty title="No recordings" description={live ? "Start a recording while the room is live." : "Recordings can be started while the channel is live."} />
        ) : (
          query.data && (
            <>
              <Table
                rows={query.data.items}
                rowKey={(r) => r.recordingJobId}
                columns={[
                  { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
                  { header: "Started", className: "whitespace-nowrap", cell: (r) => formatDate(r.startedAt ?? r.createdAt) },
                  { header: "Duration", cell: (r) => formatDuration(r.durationSeconds) },
                  {
                    header: "File / reason",
                    cell: (r) =>
                      r.failureReason ? (
                        <span className="text-xs text-red-600">{r.failureReason}</span>
                      ) : (
                        <span className="font-mono text-xs break-all text-slate-500">{r.storagePath ?? "—"}</span>
                      ),
                  },
                ]}
              />
              <Pagination offset={offset} limit={LIMIT} total={query.data.total} onChange={setOffset} />
            </>
          )
        )}
      </div>
    </Card>
  );
}
