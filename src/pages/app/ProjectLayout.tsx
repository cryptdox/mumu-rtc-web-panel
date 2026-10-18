import { Link, NavLink, Outlet, useOutletContext, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { projects } from "@/api/rtc";
import type { Project } from "@/api/types";
import { ErrorBox, Loading, StatusBadge, cx } from "@/components/ui";

const tabs = [
  { to: "", label: "Overview", end: true },
  { to: "channels", label: "Channels" },
  { to: "tokens", label: "Tokens" },
  { to: "usage", label: "Usage" },
  { to: "webhooks", label: "Webhooks" },
  { to: "events", label: "Events" },
];

export function useProject() {
  return useOutletContext<{ project: Project }>().project;
}

export default function ProjectLayout() {
  const { projectId = "" } = useParams();
  const query = useQuery({ queryKey: ["project", projectId], queryFn: () => projects.get(projectId) });

  if (query.isLoading) return <Loading />;
  if (query.error || !query.data) {
    return (
      <div className="space-y-4">
        <ErrorBox error={query.error ?? new Error("Project not found")} onRetry={() => query.refetch()} />
        <Link to="/app" className="text-sm text-brand-600">
          ← Back to projects
        </Link>
      </div>
    );
  }

  const project = query.data;
  return (
    <>
      <div className="mb-6">
        <Link to="/app" className="text-xs text-slate-500 hover:text-slate-700">
          ← Projects
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
          {!project.isActive && <StatusBadge status="OFFLINE" />}
        </div>
      </div>
      <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 px-4 dark:border-slate-800">
        {tabs.map((t) => (
          <NavLink
            key={t.label}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cx(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
                isActive
                  ? "border-brand-600 text-brand-700 dark:text-brand-100"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet context={{ project }} />
    </>
  );
}
