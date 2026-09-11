"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createTaskFromAlertAction,
  updateOperatorAlertWorkflowAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function OperatorAlertControls({
  alertId,
  assignedUserId,
  dueAt,
  hasTask,
  teamMembers,
}: {
  alertId: string;
  assignedUserId?: string | null;
  dueAt?: string | null;
  hasTask?: boolean;
  teamMembers?: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"resolve" | "save" | "task" | null>(null);
  const [selectedUserId, setSelectedUserId] = useState(assignedUserId ?? "");
  const [dueDate, setDueDate] = useState(dueAt ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const showWorkflow = Boolean(teamMembers && teamMembers.length > 0);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <div className="mt-4">
      {showWorkflow ? (
        <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
          <div className="grid gap-3 md:grid-cols-[1fr_0.8fr_auto]">
            <select
              className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
              onChange={(event) => setSelectedUserId(event.target.value)}
              value={selectedUserId}
            >
              <option value="">Unassigned</option>
              {teamMembers?.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} · {member.role}
                </option>
              ))}
            </select>
            <Input onChange={(event) => setDueDate(event.target.value)} type="date" value={dueDate} />
            <Button
              disabled={pending !== null || !hydrated}
              onClick={async () => {
                setError(null);
                setSuccess(null);
                setPending("save");
                const result = await updateOperatorAlertWorkflowAction(alertId, {
                  assignedUserId: selectedUserId,
                  dueAt: dueDate,
                });
                setPending(null);

                if (!result.success) {
                  setError(result.error ?? "Alert workflow update failed.");
                  return;
                }

                router.refresh();
              }}
              size="sm"
              variant="secondary"
            >
              {pending === "save" ? "Saving..." : "Save queue"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className={showWorkflow ? "mt-3 flex flex-wrap gap-3" : "flex flex-wrap gap-3"}>
        <Button
          disabled={pending !== null || !hydrated || Boolean(hasTask)}
              onClick={async () => {
                setError(null);
                setSuccess(null);
                setPending("task");
                const result = await createTaskFromAlertAction(alertId);
                setPending(null);

            if (!result.success) {
              setError(result.error ?? "Task creation failed.");
              return;
            }

            router.refresh();
          }}
          size="sm"
          variant="secondary"
        >
          {pending === "task" ? "Creating task..." : hasTask ? "Task created" : "Create task"}
        </Button>
        <Button
          disabled={pending !== null || !hydrated}
              onClick={async () => {
                setError(null);
                setSuccess(null);
                setPending("resolve");
                const response = await fetch(`/api/alerts/${alertId}/resolve`, {
                  method: "POST",
                }).catch(() => null);
                setPending(null);

                if (!response?.ok) {
                  setError("Alert resolution failed.");
                  return;
                }

                setSuccess("Alert resolved. Refreshing queues.");
                router.refresh();
              }}
          size="sm"
          variant="ghost"
        >
          {pending === "resolve" ? "Resolving..." : "Resolve alert"}
        </Button>
      </div>
      {success ? <p className="mt-2 text-sm text-sage-700">{success}</p> : null}
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
