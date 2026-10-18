import { useState } from "react";
import { useNavigate } from "react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projects } from "@/api/rtc";
import type { Project, ProjectWithSecret } from "@/api/types";
import { formatDate } from "@/lib/format";
import { Button, Card, type Column, Empty, ErrorBox, Input, Loading, Modal, PageHeader, Pagination, SecretRevealModal, StatusBadge, Table, Textarea } from "@/components/ui";

const LIMIT = 20;

const ownerColumn: Column<Project> = { header: "Owner", cell: (p) => <code className="text-xs">{p.ownerUserId}</code> };

/** Project list. Admins (master realm) see every project; developers see their own. */
export default function Projects({ adminView = false }: { adminView?: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<ProjectWithSecret | null>(null);

  const query = useQuery({
    queryKey: ["projects", { offset, search }],
    queryFn: () => projects.list({ offset, limit: LIMIT, search: search || undefined }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title={adminView ? "All projects" : "Projects"}
        description={adminView ? "Every project on the platform." : "Each project is one app with its own API key, channels, usage and webhooks."}
        actions={!adminView && <Button onClick={() => setCreating(true)}>New project</Button>}
      />

      <Card
        actions={
          <Input
            placeholder="Search projects…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            className="w-64"
          />
        }
        title={query.data ? `${query.data.total} project${query.data.total === 1 ? "" : "s"}` : "Projects"}
      >
        <ErrorBox error={query.error} onRetry={() => query.refetch()} />
        {query.isLoading ? (
          <Loading />
        ) : query.data && query.data.items.length === 0 ? (
          <Empty
            title={search ? "No matching projects" : "No projects yet"}
            description={!adminView && !search ? "Create a project to get your API key and start issuing tokens." : undefined}
            action={!adminView && !search && <Button onClick={() => setCreating(true)}>Create project</Button>}
          />
        ) : (
          query.data && (
            <>
              <Table
                rows={query.data.items}
                rowKey={(p) => p.projectId}
                onRowClick={(p) => navigate(`/app/projects/${p.projectId}`)}
                columns={[
                  {
                    header: "Name",
                    cell: (p) => (
                      <div>
                        <div className="font-medium">{p.name}</div>
                        {p.description && <div className="max-w-xs truncate text-xs text-slate-500">{p.description}</div>}
                      </div>
                    ),
                  },
                  { header: "API key", cell: (p) => <code className="font-mono text-xs">{p.apiKey}</code> },
                  { header: "Status", cell: (p) => <StatusBadge status={p.isActive ? "ACTIVE" : "OFFLINE"} /> },
                  ...(adminView ? [ownerColumn] : []),
                  { header: "Created", className: "whitespace-nowrap", cell: (p) => <span className="text-slate-500">{formatDate(p.createdAt)}</span> },
                ]}
              />
              <Pagination offset={offset} limit={LIMIT} total={query.data.total} onChange={setOffset} />
            </>
          )
        )}
      </Card>

      <CreateProjectModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(p) => {
          setCreating(false);
          setCreated(p);
          qc.invalidateQueries({ queryKey: ["projects"] });
        }}
      />
      <SecretRevealModal
        open={!!created}
        onClose={() => {
          const id = created?.projectId;
          setCreated(null);
          if (id) navigate(`/app/projects/${id}`);
        }}
        title="Project created"
        secrets={created ? [{ label: "API key", value: created.apiKey }, { label: "API secret", value: created.apiSecret }] : []}
      />
    </>
  );
}

function CreateProjectModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (p: ProjectWithSecret) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const mutation = useMutation({
    mutationFn: () => projects.create({ name, description: description || undefined }),
    onSuccess: (p) => {
      setName("");
      setDescription("");
      onCreated(p);
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New project"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="create-project" type="submit" loading={mutation.isPending}>
            Create
          </Button>
        </>
      }
    >
      <form
        id="create-project"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <Input label="Name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <Textarea label="Description" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
        <ErrorBox error={mutation.error} />
      </form>
    </Modal>
  );
}
