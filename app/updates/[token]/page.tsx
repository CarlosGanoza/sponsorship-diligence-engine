import { notFound } from "next/navigation";

import { PublicUpdateIntakeForm } from "@/components/candidate/public-update-intake-form";
import { Card } from "@/components/ui/card";
import { CANDIDATE_UPDATE_STATUS_LABELS } from "@/lib/candidate-updates";
import {
  CANDIDATE_UPDATE_ACCESS_LINK_STATUS_LABELS,
  getCandidateUpdateAccessContext,
} from "@/lib/candidate-updates/access-links";
import {
  getProofRequestArtifactSuggestion,
  getProofRequestSubmissionGuidance,
  PROOF_REQUEST_TYPE_LABELS,
  PROOF_REQUEST_STATUS_LABELS,
} from "@/lib/proof-requests";
import { formatDate } from "@/lib/utils/format";

export default async function CandidateUpdateIntakePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const context = await getCandidateUpdateAccessContext(token);

  if (!context) {
    notFound();
  }

  const guidance = getProofRequestSubmissionGuidance(context.proofRequest.requestType);
  const suggestedArtifactType = getProofRequestArtifactSuggestion(context.proofRequest.requestType);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f4ec_0%,#fbfaf7_100%)] px-6 py-10 text-ink-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.22em] text-ink-400">Secure evidence update</p>
          <h1 className="font-serif text-5xl leading-tight text-ink-900">Submit new proof for review</h1>
          <p className="max-w-2xl text-sm leading-7 text-ink-600">
            This secure link lets you add new evidence to the current review request. The submission will be stored as inspectable text and reviewed by the operator team before any sponsor-facing use.
          </p>
        </div>

        <Card className="px-6 py-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-sage-100 px-3 py-1 text-xs uppercase tracking-[0.18em] text-sage-800">
              {context.candidateSafeStatus.label}
            </span>
            <span className="inline-flex items-center rounded-full bg-ink-100 px-3 py-1 text-xs uppercase tracking-[0.18em] text-ink-500">
              Review request
            </span>
          </div>
          <p className="mt-3 text-sm leading-7 text-ink-600">{context.candidateSafeStatus.detail}</p>
        </Card>

        <section className="grid gap-5 md:grid-cols-4">
          <Card className="px-5 py-5">
            <p className="text-sm font-medium text-ink-900">Open requests</p>
            <p className="mt-2 font-serif text-3xl text-ink-900">{context.updateStats.openRequests}</p>
            <p className="mt-2 text-sm leading-7 text-ink-500">Requests still waiting on evidence from this secure intake flow.</p>
          </Card>
          <Card className="px-5 py-5">
            <p className="text-sm font-medium text-ink-900">Resolved requests</p>
            <p className="mt-2 font-serif text-3xl text-ink-900">{context.updateStats.resolvedRequests}</p>
            <p className="mt-2 text-sm leading-7 text-ink-500">Requests already closed after review or follow-through.</p>
          </Card>
          <Card className="px-5 py-5">
            <p className="text-sm font-medium text-ink-900">Recent submissions</p>
            <p className="mt-2 font-serif text-3xl text-ink-900">{context.updateStats.submitted}</p>
            <p className="mt-2 text-sm leading-7 text-ink-500">Candidate updates recorded for this file across the current review cycle.</p>
          </Card>
          <Card className="px-5 py-5">
            <p className="text-sm font-medium text-ink-900">Incorporated updates</p>
            <p className="mt-2 font-serif text-3xl text-ink-900">{context.updateStats.incorporated}</p>
            <p className="mt-2 text-sm leading-7 text-ink-500">Submissions already folded back into the underwriting file.</p>
          </Card>
        </section>

        <Card className="px-6 py-6">
          <p className="text-sm font-medium text-ink-900">{context.proofRequest.title}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-ink-100 px-3 py-1 text-xs uppercase tracking-[0.18em] text-ink-500">
              {PROOF_REQUEST_TYPE_LABELS[context.proofRequest.requestType]}
            </span>
            <span className="inline-flex items-center rounded-full bg-ink-100 px-3 py-1 text-xs uppercase tracking-[0.18em] text-ink-500">
              {PROOF_REQUEST_STATUS_LABELS[context.proofRequest.status]}
            </span>
            <span className="inline-flex items-center rounded-full bg-ink-100 px-3 py-1 text-xs uppercase tracking-[0.18em] text-ink-500">
              Suggested evidence: {suggestedArtifactType.replaceAll("_", " ")}
            </span>
            {context.proofRequest.dueAt ? (
              <span className="inline-flex items-center rounded-full bg-ink-100 px-3 py-1 text-xs uppercase tracking-[0.18em] text-ink-500">
                Due {context.proofRequest.dueAt.toLocaleDateString()}
              </span>
            ) : null}
            {context.proofRequest.reminderCount > 0 ? (
              <span className="inline-flex items-center rounded-full bg-ink-100 px-3 py-1 text-xs uppercase tracking-[0.18em] text-ink-500">
                {context.proofRequest.reminderCount} reminder{context.proofRequest.reminderCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-7 text-ink-600">{context.proofRequest.detail}</p>
          {context.proofRequest.lastReminderAt ? (
            <p className="mt-3 text-sm leading-7 text-ink-500">
              Last reminder: {formatDate(context.proofRequest.lastReminderAt)}.{" "}
              {context.proofRequest.lastReminderNote ?? "The operator team is still waiting on updated proof."}
            </p>
          ) : null}
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-400">
            Link {CANDIDATE_UPDATE_ACCESS_LINK_STATUS_LABELS[context.link.status].toLowerCase()} · expires{" "}
            {context.link.expiresAt.toLocaleDateString()}
          </p>
        </Card>

        <section className="grid gap-5 md:grid-cols-3">
          <Card className="px-6 py-6">
            <p className="text-sm font-medium text-ink-900">What happens next</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-ink-400">1. Submit inspectable proof</p>
                <p className="mt-2 text-sm leading-7 text-ink-600">
                  Add the clearest version of the evidence, including what you owned directly and any measurable result.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-ink-400">2. Operator review</p>
                <p className="mt-2 text-sm leading-7 text-ink-600">
                  The review team checks support quality, contradictions, and whether the new material resolves the request.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-ink-400">3. Underwriting file updates</p>
                <p className="mt-2 text-sm leading-7 text-ink-600">
                  Once accepted, the submission is incorporated into the evidence file before any sponsor-facing use.
                </p>
              </div>
            </div>
          </Card>

          <Card className="px-6 py-6 md:col-span-2">
            <p className="text-sm font-medium text-ink-900">Request history</p>
            <div className="mt-4 space-y-3">
              {context.requestHistory.map((request) => (
                <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={request.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink-900">{request.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink-400">
                        {PROOF_REQUEST_TYPE_LABELS[request.requestType]} · {PROOF_REQUEST_STATUS_LABELS[request.status]}
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-[0.18em] text-ink-400">{formatDate(request.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-ink-500">
                    {request.dueAt ? `Due ${formatDate(request.dueAt)}.` : "No due date recorded."}{" "}
                    {request.resolvedAt ? `Resolved ${formatDate(request.resolvedAt)}.` : "Still under review."}
                  </p>
                  {request.reminderCount > 0 ? (
                    <p className="mt-2 text-sm leading-7 text-ink-500">
                      {request.reminderCount} reminder{request.reminderCount === 1 ? "" : "s"} sent.
                    </p>
                  ) : null}
                  {request.resolutionNote ? (
                    <p className="mt-2 text-sm leading-7 text-ink-600">{request.resolutionNote}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <Card className="px-6 py-6">
            <p className="text-sm font-medium text-ink-900">Recent submissions</p>
            <div className="mt-4 space-y-3">
              {context.recentCandidateUpdates.map((update) => (
                <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={update.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink-900">{update.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink-400">
                        {update.sourceProofRequest?.title ?? "General update"} · {CANDIDATE_UPDATE_STATUS_LABELS[update.status]}
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-[0.18em] text-ink-400">{formatDate(update.submittedAt)}</span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink-600">{update.summary}</p>
                  {update.artifact ? (
                    <p className="mt-2 text-sm leading-7 text-ink-500">
                      Stored as {update.artifact.artifactType.replaceAll("_", " ").toLowerCase()} · v{update.artifact.versionNumber}
                    </p>
                  ) : null}
                  {update.incorporationNote ? (
                    <p className="mt-2 text-sm leading-7 text-ink-500">{update.incorporationNote}</p>
                  ) : null}
                </div>
              ))}
              {context.recentCandidateUpdates.length === 0 ? (
                <p className="text-sm text-ink-500">No prior updates are recorded for this candidate yet.</p>
              ) : null}
            </div>
          </Card>

          <Card className="px-6 py-6">
            <p className="text-sm font-medium text-ink-900">Proof request inbox</p>
            <div className="mt-4 space-y-3">
              {context.openProofRequests.map((request) => (
                <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={request.id}>
                  <p className="text-sm font-medium text-ink-900">{request.title}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink-400">
                    {PROOF_REQUEST_STATUS_LABELS[request.status]}
                    {request.dueAt ? ` · due ${formatDate(request.dueAt)}` : ""}
                  </p>
                  {request.reminderCount > 0 || request.lastReminderAt ? (
                    <p className="mt-2 text-sm leading-6 text-ink-500">
                      {request.reminderCount > 0
                        ? `${request.reminderCount} reminder${request.reminderCount === 1 ? "" : "s"} sent`
                        : "Reminder status not recorded"}
                      {request.lastReminderAt ? ` · last sent ${formatDate(request.lastReminderAt)}` : ""}
                    </p>
                  ) : null}
                </div>
              ))}
              {context.openProofRequests.length === 0 ? (
                <p className="text-sm text-ink-500">No other open requests are active right now.</p>
              ) : null}
            </div>
          </Card>

          <Card className="px-6 py-6">
            <p className="text-sm font-medium text-ink-900">Evidence already on file</p>
            <div className="mt-4 space-y-3">
              {context.currentArtifacts.map((artifact) => (
                <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={artifact.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink-900">{artifact.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink-400">
                        {artifact.artifactType.replaceAll("_", " ")} · {artifact.sourceLabel}
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-[0.18em] text-ink-400">v{artifact.versionNumber}</span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-ink-500">Last updated {formatDate(artifact.updatedAt)}</p>
                </div>
              ))}
              {context.currentArtifacts.length === 0 ? (
                <p className="text-sm text-ink-500">No current artifacts are visible for this file yet.</p>
              ) : null}
            </div>
          </Card>
        </section>

        {context.isActive ? (
          <PublicUpdateIntakeForm
            guidanceChecklist={guidance.checklist}
            guidanceExample={guidance.examplePrompt}
            replaceableArtifacts={context.candidate.artifacts.map((artifact) => ({
              id: artifact.id,
              title: artifact.title,
              artifactType: artifact.artifactType,
              versionNumber: artifact.versionNumber,
            }))}
            requestTitle={context.proofRequest.title}
            suggestedArtifactType={suggestedArtifactType}
            token={token}
          />
        ) : (
          <Card className="px-6 py-6">
            <p className="text-sm font-medium text-ink-900">This secure link is no longer active</p>
            <p className="mt-3 text-sm leading-7 text-ink-600">
              The request may have been completed, revoked, or allowed to expire. Contact the operator who sent the link if a new submission is still needed.
            </p>
          </Card>
        )}

        <Card className="px-6 py-6">
          <p className="text-sm font-medium text-ink-900">Privacy and review note</p>
          <p className="mt-3 text-sm leading-7 text-ink-600">
            Submitted material is stored for internal review, converted into inspectable text for evidence analysis, and used only inside the sponsorship workflow for this workspace. The team does not treat this link as public or sponsor-facing distribution.
          </p>
        </Card>
      </div>
    </main>
  );
}
