import { extractBracketCitations } from "@/lib/utils/strings";

export function AnnotatedText({
  text,
  tone = "default",
}: {
  text: string;
  tone?: "default" | "inverse";
}) {
  const { cleanText, citations } = extractBracketCitations(text);

  return (
    <div>
      <p
        className={`whitespace-pre-line text-sm leading-7 ${
          tone === "inverse" ? "text-white/82" : "text-ink-600"
        }`}
      >
        {cleanText}
      </p>
      {citations.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {citations.map((citation) => (
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                tone === "inverse"
                  ? "bg-white/10 text-white/75"
                  : "bg-sage-100 text-sage-700"
              }`}
              key={`${tone}-${citation}`}
            >
              {citation}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
