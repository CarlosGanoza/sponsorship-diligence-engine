import Link from "next/link";
import { SavedViewPage } from "@prisma/client";

import { AppShell } from "@/components/dashboard/app-shell";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SavedViewControls } from "@/components/dashboard/saved-view-controls";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSavedViews, getTasksDataWithFilters, searchValueToString } from "@/lib/db/queries";
import { buildSavedViewQueryString } from "@/lib/saved-views";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/workflow/tasks";
import { TaskControls } from "@/components/tasks/task-controls";

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const filters = {
    query: searchValueToString(resolved.q),
    status: searchValueToString(resolved.status) || "all",
    owner: searchValueToString(resolved.owner) || "all",
    priority: searchValueToString(resolved.priority) || "all",
  };
  const [data, savedViews] = await Promise.all([
    getTasksDataWithFilters(filters),
    getSavedViews(SavedViewPage.TASKS),
  ]);
  const currentQueryString = buildSavedViewQueryString({
    q: filters.query,
    status: filters.status !== "all" ? filters.status : undefined,
    owner: filters.owner !== "all" ? filters.owner : undefined,
    priority: filters.priority !== "all" ? filters.priority : undefined,
  });

  return (
    <AppShell
      title="Operator tasks"
      description="Turn alerts and pipeline friction into assigned work with explicit owners, due dates, and completion state."
    >
      <section className="grid gap-5 xl:grid-cols-5">
        <KpiCard detail="All workflow items" label="Total tasks" value={data.stats.total} />
        <KpiCard detail="Waiting for action" label="Open" value={data.stats.open} />
        <KpiCard detail="Actively being worked" label="In progress" value={data.stats.inProgress} />
        <KpiCard detail="Need unblock or escalation" label="Blocked" value={data.stats.blocked} />
        <KpiCard detail="Closed tasks" label="Completed" value={data.stats.completed} />
      </section>

      <Card className="px-5 py-5">
        <form className="grid gap-4 lg:grid-cols-[1.3fr_repeat(3,0.9fr)_auto]" method="get">
          <Input defaultValue={filters.query} name="q" placeholder="Search task, candidate, sponsor, or source" />
          <select
            className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            defaultValue={filters.status}
            name="status"
          >
            <option value="all">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="BLOCKED">Blocked</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <select
            className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            defaultValue={filters.owner}
            name="owner"
          >
            <option value="all">All owners</option>
            <option value="unowned">Unowned</option>
            {data.teamMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            defaultValue={filters.priority}
            name="priority"
          >
            <option value="all">All priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
          <button
            className="h-11 rounded-2xl bg-ink-900 px-4 text-sm font-medium text-white transition hover:bg-ink-800"
            type="submit"
          >
            Apply filters
          </button>
        </form>
      </Card>

      <SavedViewControls
        currentQueryString={currentQueryString}
        page={SavedViewPage.TASKS}
        pagePath="/tasks"
        savedViews={savedViews}
      />

      <section className="space-y-5">
        {data.tasks.map((task) => (
          <Card className="px-5 py-5" key={task.id}>
            <div className="flex items-start justify-between gap-4 border-b border-ink-100 pb-4">
              <div>
                <p className="font-medium text-ink-900">{task.title}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="muted">{TASK_STATUS_LABELS[task.status]}</Badge>
                  <Badge variant={task.priority === "URGENT" || task.priority === "HIGH" ? "danger" : "muted"}>
                    {TASK_PRIORITY_LABELS[task.priority]}
                  </Badge>
                  {task.owner ? <Badge variant="sage">{task.owner.name}</Badge> : <Badge variant="muted">Unowned</Badge>}
                  {task.dueAtLabel ? <Badge variant="muted">Due {task.dueAtLabel}</Badge> : null}
                </div>
              </div>
              <div className="text-right">
                {task.candidate ? (
                  <Link className="text-sm font-medium text-ink-900 hover:text-sage-700" href={`/candidates/${task.candidateId}`}>
                    {task.candidate.fullName}
                  </Link>
                ) : null}
                {task.sponsor ? <p className="mt-1 text-sm text-ink-500">{task.sponsor.fullName}</p> : null}
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-ink-600">{task.detail}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-400">{task.sourceLabel}</p>
            <TaskControls
              initialDueAt={task.dueAt ? task.dueAt.toISOString().slice(0, 10) : null}
              initialOwnerUserId={task.ownerUserId}
              initialStatus={task.status}
              taskId={task.id}
              teamMembers={data.teamMembers.map((member) => ({
                id: member.id,
                name: member.name,
                role: member.role,
              }))}
            />
          </Card>
        ))}
        {data.tasks.length === 0 ? (
          <Card className="px-6 py-8">
            <p className="font-medium text-ink-900">No operator tasks yet</p>
            <p className="mt-3 text-sm leading-7 text-ink-500">
              Create tasks directly from alerts or pipeline follow-up to turn automated signals into owned work.
            </p>
          </Card>
        ) : null}
      </section>
    </AppShell>
  );
}
