import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function MarketingPage() {
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-white">
      <header className="shrink-0 px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between border-b border-ink-100 pb-4">
          <Link className="flex items-center gap-3" href={"/" as Route}>
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-200 text-sm font-semibold tracking-[0.12em] text-ink-900">
              SS
            </span>
            <span className="text-sm uppercase tracking-[0.3em] text-ink-700">SignalSponsor</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-ink-500 md:flex">
            <span>How it works</span>
            <span>About</span>
            <Link className="transition hover:text-ink-900" href={"/login" as Route}>
              Login
            </Link>
          </nav>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-6">
        <div className="mx-auto w-full max-w-4xl text-center">
          <div className="mx-auto max-w-3xl">
            <h1 className="font-serif text-[clamp(3rem,8vw,5.5rem)] leading-[0.95] text-ink-900">
              Evidence-backed sponsorship decisions.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-ink-600 md:text-lg">
              SignalSponsor turns scattered artifacts into a clear sponsorship case.
            </p>

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href={"/login?next=/demo" as Route}>
                  Open guided demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href={"/login?next=/dashboard" as Route}>View workspace</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
