import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projects, usage } from "@/api/rtc";
import type { ProjectWithSecret } from "@/api/types";
import { config } from "@/config";
import { formatDate, formatNumber, humanize, localMidnightIso, startOfMonth } from "@/lib/format";
import { useProject } from "./ProjectLayout";
import {
  Button,
  Card,
  CodeBlock,
  ConfirmModal,
  CopyField,
  ErrorBox,
  Input,
  SecretRevealModal,
  Stat,
  Textarea,
  Toggle,
} from "@/components/ui";

export default function ProjectOverview() {
  const project = useProject();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  useEffect(() => {
    setName(project.name);
    setDescription(project.description ?? "");
  }, [project]);

  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotated, setRotated] = useState<ProjectWithSecret | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["project", project.projectId] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  const save = useMutation({
    mutationFn: () => projects.update(project.projectId, { name, description: description || null }),
    onSuccess: refresh,
  });
  const toggleActive = useMutation({
    mutationFn: (isActive: boolean) => projects.update(project.projectId, { isActive }),
    onSuccess: refresh,
  });
  const rotate = useMutation({
    mutationFn: () => projects.rotateSecret(project.projectId),
    onSuccess: (p) => {
      setRotateOpen(false);
      setRotated(p);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: () => projects.remove(project.projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      navigate("/app", { replace: true });
    },
  });

  const summary = useQuery({
    queryKey: ["usage-summary", project.projectId, "month"],
    queryFn: () => usage.summary(project.projectId, { from: localMidnightIso(startOfMonth()) }),
  });
  const total = (type: string) => summary.data?.totals.find((t) => t.usageType === type)?.totalUsage ?? 0;

  const dirty = name !== project.name || description !== (project.description ?? "");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {(["VIDEO_MINUTES", "AUDIO_MINUTES", "RECORDING_STORAGE_MB"] as const).map((t) => (
          <Stat key={t} label={`${humanize(t)} · this month`} value={summary.isLoading ? "…" : formatNumber(total(t))} />
        ))}
      </div>

      <Card title="Credentials">
        <div className="space-y-4">
          <CopyField label="API key" value={project.apiKey} />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/50">
            <span className="text-slate-600 dark:text-slate-300">
              The API secret is only shown when created or rotated. Rotating it invalidates every token signed with the old one.
            </span>
            <Button variant="secondary" size="sm" onClick={() => setRotateOpen(true)}>
              Rotate secret
            </Button>
          </div>
          <p className="text-xs font-medium text-slate-500">Issue a token from your backend</p>
          <CodeBlock
            language="bash"
            code={`curl -X POST ${config.apiUrl}/api/server/token \\\n  -u "${project.apiKey}:$MUMU_API_SECRET" \\\n  -H "content-type: application/json" \\\n  -d '{ "externalUserId": "user-1", "channelName": "demo" }'`}
          />
        </div>
      </Card>

      <Card title="Settings">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Input label="Name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea label="Description" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
          <ErrorBox error={save.error} />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Created {formatDate(project.createdAt)}</span>
            <Button type="submit" disabled={!dirty} loading={save.isPending}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Danger zone" className="ring-red-200 dark:ring-red-500/30">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Project enabled</p>
              <p className="text-xs text-slate-500">Disabled projects can't issue tokens, join channels or call the server API.</p>
            </div>
            <Toggle checked={project.isActive} disabled={toggleActive.isPending} onChange={(v) => toggleActive.mutate(v)} />
          </div>
          <ErrorBox error={toggleActive.error} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
            <div>
              <p className="text-sm font-medium">Delete project</p>
              <p className="text-xs text-slate-500">Permanently deletes channels, sessions, recordings, usage and webhooks.</p>
            </div>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              Delete project
            </Button>
          </div>
        </div>
      </Card>

      <ConfirmModal
        open={rotateOpen}
        onClose={() => setRotateOpen(false)}
        onConfirm={() => rotate.mutate()}
        title="Rotate API secret?"
        message="Your backend must switch to the new secret. Every RTC token signed with the current secret stops working immediately."
        confirmLabel="Rotate"
        danger
        loading={rotate.isPending}
        error={rotate.error}
      />
      <SecretRevealModal
        open={!!rotated}
        onClose={() => setRotated(null)}
        title="New API secret"
        secrets={rotated ? [{ label: "API secret", value: rotated.apiSecret }] : []}
      />
      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate()}
        title="Delete project?"
        message={
          <>
            This permanently deletes <b>{project.name}</b> and all of its data. This can't be undone.
          </>
        }
        confirmText={project.name}
        confirmLabel="Delete forever"
        danger
        loading={remove.isPending}
        error={remove.error}
      />
    </div>
  );
}
