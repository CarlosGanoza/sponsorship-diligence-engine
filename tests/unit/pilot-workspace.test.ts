import { getPilotTemplate } from "@/lib/pilot/templates";
import {
  buildDefaultPilotProfile,
  buildPilotLaunchWorkstream,
  parsePilotProfile,
  serializeUpdatedPilotLaunchState,
} from "@/lib/pilot/workspace";

describe("pilot workspace packaging", () => {
  it("falls back to a default pilot profile when persisted data is invalid", () => {
    const template = getPilotTemplate("FOUNDATION");
    const defaults = buildDefaultPilotProfile({
      workspaceName: "SignalSponsor Demo Workspace",
      template,
    });

    expect(parsePilotProfile("{bad json", defaults)).toEqual(defaults);
  });

  it("builds launch workstream summaries from persisted template state", () => {
    const template = getPilotTemplate("FOUNDATION");
    const workstream = buildPilotLaunchWorkstream(
      template,
      JSON.stringify({
        FOUNDATION: {
          "choose-one-operator-owner": {
            status: "READY",
            owner: "Program lead",
            completedAt: "2026-03-01T10:00:00.000Z",
            updatedAt: "2026-03-01T10:00:00.000Z",
          },
          "seed-a-contained-slate": {
            status: "IN_PROGRESS",
            dueAt: "2026-03-25",
            note: "Need two more files loaded.",
            updatedAt: "2026-03-20T10:00:00.000Z",
          },
        },
      }),
    );

    expect(workstream.summary.total).toBe(4);
    expect(workstream.summary.readyCount).toBe(1);
    expect(workstream.summary.inProgressCount).toBe(1);
    expect(workstream.summary.notStartedCount).toBe(2);
    expect(workstream.summary.statusLabel).toBe("In launch prep");
    expect(workstream.summary.nextDueAt).toBe("2026-03-25");
  });

  it("updates launch state per template and marks ready items complete", () => {
    const nextState = serializeUpdatedPilotLaunchState({
      currentValue: JSON.stringify({
        FOUNDATION: {
          "choose-one-operator-owner": {
            status: "READY",
            owner: "Program lead",
            completedAt: "2026-03-01T10:00:00.000Z",
          },
        },
      }),
      templateKey: "FOUNDATION",
      slug: "seed-a-contained-slate",
      update: {
        status: "READY",
        owner: "Ops analyst",
        dueAt: "2026-03-28",
        note: "Slate is now complete.",
      },
    });

    const workstream = buildPilotLaunchWorkstream(getPilotTemplate("FOUNDATION"), nextState);
    const updatedItem = workstream.items.find((item) => item.slug === "seed-a-contained-slate");

    expect(updatedItem).toMatchObject({
      status: "READY",
      currentOwner: "Ops analyst",
      dueAt: "2026-03-28",
      note: "Slate is now complete.",
    });
    expect(updatedItem?.completedAt).toBeTruthy();
  });
});
