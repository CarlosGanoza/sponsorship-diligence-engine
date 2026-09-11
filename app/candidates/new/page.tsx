import { AppShell } from "@/components/dashboard/app-shell";
import { CandidateCreateForm } from "@/components/forms/candidate-create-form";

export default function NewCandidatePage() {
  return (
    <AppShell
      title="New candidate"
      description="Create a fresh profile, then attach evidence artifacts that can support extraction, memo generation, and sponsor matching."
    >
      <CandidateCreateForm />
    </AppShell>
  );
}
