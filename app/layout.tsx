import type { Metadata } from "next";

import "@/app/globals.css";
import { env } from "@/lib/db/env";

export const metadata: Metadata = {
  title: `${env.appName} | Evidence-backed sponsorship decisions`,
  description:
    "SignalSponsor helps operators decide when someone is worth sponsoring, not only mentoring, using traceable evidence and sponsor-ready conviction memos.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="font-sans text-ink-900 antialiased">
        {children}
      </body>
    </html>
  );
}
