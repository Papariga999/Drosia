"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { MadeWithLove } from "@/components/ui/MadeWithLove";

type Doc = "privacy" | "imprint" | "terms";

/**
 * Shared legal page (privacy / imprint / terms). Content comes from the public
 * i18n dictionary (lib/i18n/*.json → `legal`), so the three pages stay in the
 * visitor's language. Operator identity is intentionally a placeholder — the
 * review banner flags that the text and details must be completed before launch.
 */
export function LegalScreen({ doc }: { doc: Doc }) {
  const { dict } = useLocale();
  const l = dict.legal;
  const content = l[doc];

  return (
    <div className="min-h-screen bg-surface pb-12">
      <div className="flex items-center gap-3 px-5 pt-4">
        <Link
          href="/"
          aria-label={l.back}
          className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface-card text-slate"
        >
          <ArrowLeft size={17} aria-hidden />
        </Link>
        <h1 className="font-display text-[17px] font-black">{content.title}</h1>
        <span className="ml-auto" />
        <LangSwitch />
      </div>

      <div className="mx-auto max-w-phone px-6 pt-4">
        {l.reviewNote && (
          <p className="mb-5 rounded-xl border border-line-strong bg-tint px-3.5 py-2.5 text-[12px] leading-relaxed text-ink">
            {l.reviewNote}
          </p>
        )}

        <div className="space-y-5">
          {content.sections.map((s) => (
            <section key={s.h}>
              <h2 className="font-display text-[15px] font-extrabold">{s.h}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-slate">{s.p}</p>
            </section>
          ))}
        </div>

        <nav className="mt-9 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-line pt-4 text-[12px] font-bold text-primary-ink">
          <Link href="/privacy" className="underline-offset-2 hover:underline">
            {dict.footer.privacy}
          </Link>
          <span aria-hidden className="text-muted">·</span>
          <Link href="/imprint" className="underline-offset-2 hover:underline">
            {dict.footer.imprint}
          </Link>
          <span aria-hidden className="text-muted">·</span>
          <Link href="/terms" className="underline-offset-2 hover:underline">
            {dict.footer.terms}
          </Link>
        </nav>
        <MadeWithLove className="mt-3 text-[11px] text-muted" />
      </div>
    </div>
  );
}
