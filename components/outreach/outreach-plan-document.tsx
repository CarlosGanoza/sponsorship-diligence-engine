import { BriefStatus } from "@prisma/client";

import { BriefStatusBadge } from "@/components/dashboard/brief-status-badge";
import { AnnotatedText } from "@/components/memo/annotated-text";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function OutreachPlanDocument({
  candidateName,
  sponsorName,
  sponsorOrganization,
  briefStatus,
  channelLabel,
  subjectLine,
  introRequest,
  sponsorOpening,
  meetingGoal,
  agenda,
  evidenceToLead,
  likelyQuestions,
  followUpDeliverables,
  cautionNote,
}: {
  candidateName: string;
  sponsorName: string;
  sponsorOrganization: string;
  briefStatus: BriefStatus | string;
  channelLabel: string;
  subjectLine: string;
  introRequest: string;
  sponsorOpening: string;
  meetingGoal: string;
  agenda: string[];
  evidenceToLead: string[];
  likelyQuestions: string[];
  followUpDeliverables: string[];
  cautionNote: string;
}) {
  return (
    <Card className="print-frame px-8 py-8 md:px-12 md:py-10">
      <div className="border-b border-ink-100 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-sage-600">Sponsor outreach plan</p>
            <h1 className="mt-4 font-serif text-4xl text-ink-900">{candidateName}</h1>
            <p className="mt-3 text-sm leading-7 text-ink-500">
              {sponsorName} · {sponsorOrganization}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BriefStatusBadge status={briefStatus} />
            <Badge variant="muted">{channelLabel}</Badge>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-8">
          <div>
            <h2 className="font-serif text-2xl text-ink-900">Subject line</h2>
            <div className="mt-3 rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <AnnotatedText text={subjectLine} />
            </div>
          </div>

          <div className="rounded-[2rem] bg-ink-900 px-5 py-5 text-white">
            <p className="text-sm uppercase tracking-[0.22em] text-white/60">Intro request</p>
            <div className="mt-4">
              <AnnotatedText text={introRequest} tone="inverse" />
            </div>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-ink-900">Sponsor framing</h2>
            <div className="mt-3">
              <AnnotatedText text={sponsorOpening} />
            </div>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-ink-900">Meeting goal</h2>
            <div className="mt-3 rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <AnnotatedText text={meetingGoal} />
            </div>
          </div>
        </section>

        <section className="space-y-8">
          <div>
            <h2 className="font-serif text-2xl text-ink-900">Agenda</h2>
            <div className="mt-4 space-y-4">
              {agenda.map((item) => (
                <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item}>
                  <AnnotatedText text={item} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-ink-900">Evidence to lead with</h2>
            <div className="mt-4 space-y-4">
              {evidenceToLead.map((item) => (
                <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item}>
                  <AnnotatedText text={item} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-ink-900">Likely diligence questions</h2>
            <div className="mt-4 space-y-4">
              {likelyQuestions.map((item) => (
                <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item}>
                  <AnnotatedText text={item} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-ink-900">Follow-up deliverables</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {followUpDeliverables.map((item) => (
                <Badge key={item} variant="sage">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="mt-8 rounded-[1.5rem] border border-gold-200 bg-gold-50 px-5 py-5">
        <p className="text-sm uppercase tracking-[0.18em] text-gold-700">Caution note</p>
        <div className="mt-3">
          <AnnotatedText text={cautionNote} />
        </div>
      </div>
    </Card>
  );
}
