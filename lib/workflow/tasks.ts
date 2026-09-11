import { TaskPriority, TaskStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  BLOCKED: "Blocked",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

function resolvePriorityFromAlert(severity: "INFO" | "ACTION" | "CAUTION") {
  if (severity === "ACTION") {
    return TaskPriority.HIGH;
  }

  if (severity === "CAUTION") {
    return TaskPriority.MEDIUM;
  }

  return TaskPriority.LOW;
}

export async function createTaskFromAlert(alertId: string) {
  const alert = await prisma.operatorAlert.findUnique({
    where: { id: alertId },
    include: {
      candidate: true,
      assignedUser: true,
    },
  });

  if (!alert) {
    throw new Error("Alert not found.");
  }

  const existingTask = await prisma.operatorTask.findUnique({
    where: { sourceAlertId: alertId },
  });

  if (existingTask) {
    return existingTask;
  }

  return prisma.operatorTask.create({
    data: {
      organizationId: alert.candidate.organizationId,
      candidateId: alert.candidateId,
      sourceAlertId: alert.id,
      ownerUserId: alert.assignedUserId,
      title: `${alert.candidate.fullName} · ${alert.title}`,
      detail: alert.detail,
      priority: resolvePriorityFromAlert(alert.severity),
      dueAt: alert.dueAt,
      sourceLabel: `Created from ${alert.alertType.replaceAll("_", " ").toLowerCase()} alert`,
    },
  });
}

export async function updateOperatorTask(input: {
  taskId: string;
  status: TaskStatus;
  ownerUserId?: string | null;
  dueAt?: Date | null;
}) {
  return prisma.operatorTask.update({
    where: { id: input.taskId },
    data: {
      status: input.status,
      ownerUserId: input.ownerUserId ?? null,
      dueAt: input.dueAt ?? null,
      completedAt: input.status === TaskStatus.COMPLETED ? new Date() : null,
    },
  });
}
