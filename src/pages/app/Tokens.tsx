import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tokens } from "@/api/rtc";
import { RTC_ROLES, type IssuedRtcToken, type RtcRole, type RtcToken } from "@/api/types";
import { formatDate, humanize } from "@/lib/format";
import { useProject } from "./ProjectLayout";
import { Badge, Button, Card, CodeBlock, ConfirmModal, CopyField, Empty, ErrorBox, Input, Loading, Pagination, Select, Table } from "@/components/ui";

const LIMIT = 20;

function tokenState(t: RtcToken) {
  if (t.revokedAt) return <Badge tone="red">revoked</Badge>;
  if (new Date(t.expiresAt) < new Date()) return <Badge>expired</Badge>;
  return <Badge tone="green">valid</Badge>;
}

export default function Tokens() {
  const project = useProject();
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [filterUser, setFilterUser] = useState("");
  const [revoking, setRevoking] = useState<RtcToken | null>(null);

  const query = useQuery({
    queryKey: ["tokens", project.projectId, { offset, filterUser }],
    queryFn: () => tokens.list(project.projectId, { offset, limit: LIMIT, externalUserId: filterUser || undefined }),
    placeholderData: keepPreviousData,
  });

  const revoke = useMutation({
    mutationFn: (t: RtcToken) => tokens.revoke(project.projectId, t.rtcTokenId),
    onSuccess: () => {
      setRevoking(null);
      qc.invalidateQueries({ queryKey: ["tokens", project.projectId] });
    },
  });

  return (
    <div className="space-y-6">
      <IssueTokenCard projectId={project.projectId} disabled={!project.isActive} />

      <Card
        title="Issued tokens"
        actions={
          <Input
            placeholder="Filter by user id…"
            className="w-56"
            value={filterUser}
            onChange={(e) => {
              setFilterUser(e.target.value);
              setOffset(0);
            }}
          />
        }
      >
        <ErrorBox error={query.error} onRetry={() => query.refetch()} />
        {query.isLoading ? (
          <Loading />
        ) : query.data?.items.length === 0 ? (
          <Empty title="No tokens issued yet" description="Tokens issued from here or through the server API appear in this audit list. Self-signed tokens don't." />
        ) : (
          query.data && (
            <>
              <Table
                rows={query.data.items}
                rowKey={(t) => t.rtcTokenId}
                columns={[
                  { header: "User", cell: (t) => <span className="font-mono text-xs">{t.externalUserId}</span> },
                  { header: "Channel", cell: (t) => <span className="font-mono text-xs">{t.channelName}</span> },
                  { header: "Role", cell: (t) => humanize(t.role) },
                  { header: "State", cell: tokenState },
                  { header: "Expires", className: "whitespace-nowrap", cell: (t) => <span className="text-slate-500">{formatDate(t.expiresAt)}</span> },
                  {
                    header: "",
                    className: "text-right",
                    cell: (t) =>
                      !t.revokedAt && new Date(t.expiresAt) > new Date() ? (
                        <Button variant="ghost" size="sm" onClick={() => setRevoking(t)}>
                          Revoke
                        </Button>
                      ) : null,
                  },
                ]}
              />
              <Pagination offset={offset} limit={LIMIT} total={query.data.total} onChange={setOffset} />
            </>
          )
        )}
      </Card>

      <ConfirmModal
        open={!!revoking}
        onClose={() => setRevoking(null)}
        onConfirm={() => revoking && revoke.mutate(revoking)}
        title="Revoke token?"
        message={
          <>
            <b>{revoking?.externalUserId}</b> won't be able to join <b>{revoking?.channelName}</b> with this token. Users already connected stay
            connected.
          </>
        }
        confirmLabel="Revoke"
        danger
        loading={revoke.isPending}
        error={revoke.error}
      />
    </div>
  );
}

function IssueTokenCard({ projectId, disabled }: { projectId: string; disabled: boolean }) {
  const qc = useQueryClient();
  const [externalUserId, setUser] = useState("");
  const [channelName, setChannel] = useState("");
  const [role, setRole] = useState<RtcRole>("PUBLISHER");
  const [ttlMinutes, setTtl] = useState(60);
  const [issued, setIssued] = useState<IssuedRtcToken | null>(null);

  const issue = useMutation({
    mutationFn: () => tokens.issue(projectId, { externalUserId, channelName, role, ttlSeconds: ttlMinutes * 60 }),
    onSuccess: (t) => {
      setIssued(t);
      join.reset();
      qc.invalidateQueries({ queryKey: ["tokens", projectId] });
    },
  });
  const join = useMutation({ mutationFn: (token: string) => tokens.testJoin(token) });

  return (
    <Card title="Issue a test token">
      <form
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          issue.mutate();
        }}
      >
        <Input label="User id" required maxLength={128} placeholder="user-42" value={externalUserId} onChange={(e) => setUser(e.target.value)} />
        <Input
          label="Channel"
          required
          maxLength={64}
          pattern="[A-Za-z0-9_\-.:]+"
          placeholder="team-standup"
          value={channelName}
          onChange={(e) => setChannel(e.target.value)}
        />
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as RtcRole)}>
          {RTC_ROLES.map((r) => (
            <option key={r} value={r}>
              {humanize(r)}
            </option>
          ))}
        </Select>
        <Input label="Valid for (minutes)" type="number" min={1} max={1440} required value={ttlMinutes} onChange={(e) => setTtl(Number(e.target.value))} />
        <div className="flex items-end">
          <Button type="submit" className="w-full" loading={issue.isPending} disabled={disabled}>
            Issue token
          </Button>
        </div>
      </form>
      <div className="mt-4 space-y-4">
        {disabled && <p className="text-xs text-amber-600">The project is disabled — enable it on the Overview tab to issue tokens.</p>}
        <ErrorBox error={issue.error} />
        {issued && (
          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <CopyField label={`Token for ${issued.externalUserId} → ${issued.channelName}`} value={issued.token} />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm" loading={join.isPending} onClick={() => join.mutate(issued.token)}>
                Test join
              </Button>
              <span className="text-xs text-slate-500">Calls /api/rtc/join like the client SDK would and shows the node assignment.</span>
            </div>
            <ErrorBox error={join.error} />
            {join.data && <CodeBlock language="json" code={JSON.stringify(join.data, null, 2)} />}
          </div>
        )}
      </div>
    </Card>
  );
}
