export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="app-panel w-full max-w-md px-8 py-10 text-center">
        <p className="text-sm uppercase tracking-[0.24em] text-sage-600">SignalSponsor</p>
        <h1 className="mt-3 font-serif text-3xl text-ink-900">Loading workspace</h1>
        <p className="mt-3 text-sm text-ink-500">
          Preparing the evidence graph, sponsor memos, and recommendation views.
        </p>
      </div>
    </div>
  );
}
