import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="app-panel max-w-lg px-8 py-10">
        <p className="text-sm uppercase tracking-[0.24em] text-sage-600">Not found</p>
        <h1 className="mt-3 font-serif text-3xl text-ink-900">That record is not in the current demo dataset</h1>
        <p className="mt-3 text-sm leading-6 text-ink-600">
          The link may be stale, or the demo data may have been reset.
        </p>
        <Link
          className="mt-6 inline-flex rounded-full bg-ink-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-ink-800"
          href="/dashboard"
        >
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}
