"use client";

import { startTransition, useState } from "react";
import { TaskStatus } from "@prisma/client";
import { useRouter } from "next/navigation";

import { updateOperatorTaskAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TASK_STATUS_LABELS } from "@/lib/workflow/tasks";

export function TaskControls({
  taskId,
  initialStatus,
  initialOwnerUserId,
  initialDueAt,
  teamMembers,
}: {
  taskId: string;
  initialStatus: TaskStatus;
  initialOwnerUserId?: string | null;
  initialDueAt?: string | null;
  teamMembers: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [ownerUserId, setOwnerUserId] = useState(initialOwnerUserId ?? "");
  const [dueAt, setDueAt] = useState(initialDueAt ?? "");

  return (
    <div className="mt-4 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
      <div className="grid gap-3 md:grid-cols-[0.8fr_1fr_0.8fr_auto]">
        <select
          className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
          onChange={(event) => setStatus(event.target.value as TaskStatus)}
          value={status}
        >
          {Object.values(TaskStatus).map((value) => (
            <option key={value} value={value}>
              {TASK_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <select
          className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
          onChange={(event) => setOwnerUserId(event.target.value)}
          value={ownerUserId}
        >
          <option value="">No owner</option>
          {teamMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name} · {member.role}
            </option>
          ))}
        </select>
        <Input onChange={(event) => setDueAt(event.target.value)} type="date" value={dueAt} />
        <Button
          disabled={pending}
          onClick={() => {
            setPending(true);
            setError(null);

            startTransition(async () => {
              const result = await updateOperatorTaskAction(taskId, {
                status,
                ownerUserId,
                dueAt,
              });
              setPending(false);

              if (!result.success) {
                setError(result.error ?? "Task update failed.");
                return;
              }

              router.refresh();
            });
          }}
          size="sm"
          variant="secondary"
        >
          {pending ? "Saving..." : "Save task"}
        </Button>
      </div>
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
