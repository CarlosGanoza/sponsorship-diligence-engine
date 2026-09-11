"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { createCandidateAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  fullName: z.string().min(2, "Name is required."),
  headline: z.string().min(8, "Add a more specific headline."),
  bio: z.string().min(40, "Add enough context for a first review."),
  region: z.string().min(2, "Region is required."),
});

type FormValues = z.infer<typeof schema>;

export function CandidateCreateForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      headline: "",
      bio: "",
      region: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    setIsPending(true);

    startTransition(async () => {
      const result = await createCandidateAction(values);
      setIsPending(false);

      if (!result.success || !result.id) {
        setError(result.error ?? "Could not create candidate.");
        return;
      }

      router.push(`/candidates/${result.id}`);
      router.refresh();
    });
  });

  return (
    <Card className="px-6 py-6">
      <CardHeader className="border-b border-ink-100 pb-5">
        <div>
          <CardTitle className="text-2xl">New candidate intake</CardTitle>
          <CardDescription className="mt-2">
            Add a new profile, then attach evidence artifacts before generating a memo.
          </CardDescription>
        </div>
      </CardHeader>

      <form className="mt-6 space-y-5" onSubmit={onSubmit}>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" {...form.register("fullName")} placeholder="Leila Mensah" />
            {form.formState.errors.fullName ? (
              <p className="mt-2 text-sm text-rose-600">{form.formState.errors.fullName.message}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="region">Region</Label>
            <Input id="region" {...form.register("region")} placeholder="Atlanta, GA" />
            {form.formState.errors.region ? (
              <p className="mt-2 text-sm text-rose-600">{form.formState.errors.region.message}</p>
            ) : null}
          </div>
        </div>

        <div>
          <Label htmlFor="headline">Headline</Label>
          <Input
            id="headline"
            {...form.register("headline")}
            placeholder="Workforce pathways builder connecting first-generation students to apprenticeships"
          />
          {form.formState.errors.headline ? (
            <p className="mt-2 text-sm text-rose-600">{form.formState.errors.headline.message}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="bio">Profile summary</Label>
          <Textarea
            id="bio"
            {...form.register("bio")}
            placeholder="What should an operator or sponsor understand before they read the evidence?"
          />
          {form.formState.errors.bio ? (
            <p className="mt-2 text-sm text-rose-600">{form.formState.errors.bio.message}</p>
          ) : null}
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <Button disabled={isPending} type="submit">
          {isPending ? "Creating profile..." : "Create candidate"}
        </Button>
      </form>
    </Card>
  );
}
