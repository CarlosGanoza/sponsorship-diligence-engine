"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-ink-50 px-6">
        <div className="app-panel max-w-lg px-8 py-10">
          <p className="text-sm uppercase tracking-[0.24em] text-gold-700">Application error</p>
          <h1 className="mt-3 font-serif text-3xl text-ink-900">The workspace needs attention</h1>
          <p className="mt-3 text-sm leading-6 text-ink-600">{error.message}</p>
          <button
            className="mt-6 rounded-full bg-ink-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-ink-800"
            onClick={() => reset()}
            type="button"
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
