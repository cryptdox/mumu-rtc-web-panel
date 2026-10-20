import { useState } from "react";
import { Link } from "react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { nodes, projects, subscriptionsAdmin } from "@/api/rtc";
import { useAuth } from "@/lib/auth";
import type { MediaNode, NodeStatus } from "@/api/types";
import { formatDate, formatNumber, timeAgo } from "@/lib/format";
import { Badge, Button, Card, ConfirmModal, Empty, ErrorBox, Input, Loading, PageHeader, Pagination, Select, Stat, StatusBadge, Table } from "@/components/ui";

// Matches the control plane's default NODE_HEARTBEAT_TIMEOUT_SECONDS.
const HEARTBEAT_TIMEOUT_MS = 90_000;
const isStale = (n: MediaNode) => n.status !== "OFFLINE" && Date.now() - new Date(n.lastHeartbeatAt).getTime() > HEARTBEAT_TIMEOUT_MS;

function useAllNodes() {
  return useQuery({
    queryKey: ["nodes", "all"],
    queryFn: () => nodes.list({ limit: 100 }),
    refetchInterval: 10_000,
  });
}

export function AdminOverview() {
  const { can } = useAuth();
  const nodesQ = useAllNodes();
  const projectsQ = useQuery({ queryKey: ["projects", "all", { offset: 0, search: "" }], queryFn: () => projects.list({ limit: 20, scope: "all" }) });
  const pendingQ = useQuery({
    queryKey: ["subscription-requests", { status: "PENDING", offset: 0 }],
    queryFn: () => subscriptionsAdmin.requests({ status: "PENDING", limit: 25, sortOrder: "asc" }),
    enabled: can("RTC_SUBSCRIPTION", "READ_ALL"),
  });

  const list = nodesQ.data?.items ?? [];
  const count = (s: NodeStatus) => list.filter((n) => n.status === s).length;
  const live = list.filter((n) => n.status !== "OFFLINE");
  const sum = (k: "activeRooms" | "activePeers") => live.reduce((a, n) => a + n[k], 0);
  const regions = [...new Set(live.map((n) => n.region))];

  return (
    <>
      <PageHeader title="Platform overview" description="Media fleet health and platform totals. Refreshes every 10 seconds." />
      <ErrorBox error={nodesQ.error || projectsQ.error} onRetry={() => nodesQ.refetch()} />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Live rooms" value={nodesQ.isLoading ? "…" : sum("activeRooms")} hint="as reported by node heartbeats" />
        <Stat label="Connected peers" value={nodesQ.isLoading ? "…" : sum("activePeers")} />
        <Stat
          label="Media nodes"
          value={nodesQ.isLoading ? "…" : `${count("ACTIVE")} / ${list.length}`}
          hint={`${count("DRAINING")} draining · ${count("OFFLINE")} offline`}
        />
        <Stat label="Projects" value={projectsQ.isLoading ? "…" : (projectsQ.data?.total ?? 0)} hint={<Link to="/admin/projects" className="text-brand-600">View all →</Link>} />
      </div>
      {!!pendingQ.data?.total && (
        <div className="mt-4">
          <Link to="/admin/requests" className="block rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
            {pendingQ.data.total} plan request{pendingQ.data.total === 1 ? "" : "s"} waiting for review →
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Regions">
          {live.length === 0 ? (
            <Empty title="No live nodes" description="Media nodes appear here once they register with the control plane." />
          ) : (
            <ul className="space-y-3">
              {regions.map((r) => {
                const inRegion = live.filter((n) => n.region === r);
                return (
                  <li key={r} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{r}</span>
                    <span className="text-slate-500">
                      {inRegion.length} node{inRegion.length === 1 ? "" : "s"} · {inRegion.reduce((a, n) => a + n.activePeers, 0)} peers
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card title="Attention needed" actions={<Link to="/admin/nodes" className="text-xs text-brand-600">Manage nodes →</Link>}>
          {list.filter((n) => isStale(n) || n.status === "DRAINING").length === 0 ? (
            <p className="text-sm text-slate-500">All nodes are healthy.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {list
                .filter((n) => isStale(n) || n.status === "DRAINING")
                .map((n) => (
                  <li key={n.mediaNodeId} className="flex items-center justify-between">
                    <span className="font-mono text-xs">{n.nodeId}</span>
                    {isStale(n) ? <Badge tone="red">no heartbeat {timeAgo(n.lastHeartbeatAt)}</Badge> : <StatusBadge status={n.status} />}
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

export function MediaNodes() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const canUpdate = can("RTC_MEDIA_NODE", "UPDATE");
  const canDelete = can("RTC_MEDIA_NODE", "DELETE");
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<NodeStatus | "">("");
  const [region, setRegion] = useState("");
  const [pending, setPending] = useState<{ node: MediaNode; action: NodeStatus | "DELETE" } | null>(null);

  const query = useQuery({
    queryKey: ["nodes", { offset, status, region }],
    queryFn: () => nodes.list({ offset, limit: 25, status: status || undefined, region: region || undefined }),
    placeholderData: keepPreviousData,
    refetchInterval: 10_000,
  });

  const act = useMutation({
    mutationFn: async ({ node, action }: { node: MediaNode; action: NodeStatus | "DELETE" }) => {
      if (action === "DELETE") await nodes.remove(node.mediaNodeId);
      else await nodes.setStatus(node.mediaNodeId, action);
    },
    onSuccess: () => {
      setPending(null);
      qc.invalidateQueries({ queryKey: ["nodes"] });
    },
  });

  const describe = (a: NodeStatus | "DELETE") =>
    ({
      ACTIVE: { title: "Reactivate node?", message: "The node will receive new rooms again.", label: "Reactivate", danger: false },
      DRAINING: {
        title: "Drain node?",
        message: "Live rooms stay where they are, but no new rooms are placed on this node. Use this before maintenance.",
        label: "Drain",
        danger: false,
      },
      OFFLINE: {
        title: "Force node offline?",
        message: "Every room and session on this node is closed immediately and in-flight recordings are marked failed.",
        label: "Force offline",
        danger: true,
      },
      DELETE: {
        title: "Remove node?",
        message: "Its rooms are closed and the node is removed from the registry. A running node will re-register on restart.",
        label: "Remove",
        danger: true,
      },
    })[a];

  return (
    <>
      <PageHeader title="Media nodes" description="Nodes register themselves on startup and report load every ~30 seconds." />
      <Card
        actions={
          <>
            <Select value={status} onChange={(e) => (setStatus(e.target.value as NodeStatus | ""), setOffset(0))} className="w-40">
              <option value="">Any status</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAINING">Draining</option>
              <option value="OFFLINE">Offline</option>
            </Select>
            <Input placeholder="Region" value={region} onChange={(e) => (setRegion(e.target.value), setOffset(0))} className="w-36" />
          </>
        }
        title={query.data ? `${query.data.total} node${query.data.total === 1 ? "" : "s"}` : "Nodes"}
      >
        <ErrorBox error={query.error} onRetry={() => query.refetch()} />
        {query.isLoading ? (
          <Loading />
        ) : query.data?.items.length === 0 ? (
          <Empty title="No media nodes" description="Start mumu-rtc-media-backend with MEDIA_NODE_SECRET set; it registers itself here." />
        ) : (
          query.data && (
            <>
              <Table
                rows={query.data.items}
                rowKey={(n) => n.mediaNodeId}
                columns={[
                  {
                    header: "Node",
                    cell: (n) => (
                      <div>
                        <div className="font-mono text-xs font-medium">{n.nodeId}</div>
                        <div className="text-xs text-slate-500">{n.wsUrl}</div>
                      </div>
                    ),
                  },
                  { header: "Region", className: "whitespace-nowrap", cell: (n) => n.region },
                  {
                    header: "Status",
                    cell: (n) => (
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={n.status} />
                        {isStale(n) && <Badge tone="red">stale</Badge>}
                      </div>
                    ),
                  },
                  { header: "Rooms", className: "tabular-nums", cell: (n) => n.activeRooms },
                  { header: "Peers", className: "tabular-nums", cell: (n) => n.activePeers },
                  { header: "CPU", className: "tabular-nums", cell: (n) => (n.cpuLoad != null ? `${formatNumber(n.cpuLoad * 100, 0)}%` : "—") },
                  { header: "Heartbeat", cell: (n) => <span className="text-xs text-slate-500" title={formatDate(n.lastHeartbeatAt)}>{timeAgo(n.lastHeartbeatAt)}</span> },
                  {
                    header: "",
                    className: "text-right whitespace-nowrap",
                    cell: (n) => (
                      <div className="flex justify-end gap-1">
                        {canUpdate && n.status === "ACTIVE" && (
                          <Button variant="ghost" size="sm" onClick={() => setPending({ node: n, action: "DRAINING" })}>
                            Drain
                          </Button>
                        )}
                        {canUpdate && n.status !== "ACTIVE" && (
                          <Button variant="ghost" size="sm" onClick={() => setPending({ node: n, action: "ACTIVE" })}>
                            Activate
                          </Button>
                        )}
                        {canUpdate && n.status !== "OFFLINE" && (
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setPending({ node: n, action: "OFFLINE" })}>
                            Offline
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setPending({ node: n, action: "DELETE" })}>
                            Remove
                          </Button>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
              <Pagination offset={offset} limit={25} total={query.data.total} onChange={setOffset} />
            </>
          )
        )}
      </Card>

      {pending && (
        <ConfirmModal
          open
          onClose={() => setPending(null)}
          onConfirm={() => act.mutate(pending)}
          title={describe(pending.action).title}
          message={
            <>
              <p className="mb-2 font-mono text-xs">{pending.node.nodeId}</p>
              {describe(pending.action).message}
            </>
          }
          confirmLabel={describe(pending.action).label}
          danger={describe(pending.action).danger}
          confirmText={pending.action === "OFFLINE" || pending.action === "DELETE" ? pending.node.nodeId : undefined}
          loading={act.isPending}
          error={act.error}
        />
      )}
    </>
  );
}
