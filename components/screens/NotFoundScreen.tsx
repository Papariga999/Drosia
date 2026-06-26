"use client";

import { AppBar } from "@/components/ui/AppBar";
import { ButtonLink } from "@/components/ui/Button";
import { DrosiaMark } from "@/components/brand/Logo";
import { useLocale } from "@/components/LocaleProvider";

/** Friendly localized 404 for an unknown report token. */
export function NotFoundScreen() {
  const { dict } = useLocale();
  return (
    <div>
      <AppBar showWordmark />
      <div className="px-8 pb-20 pt-16 text-center">
        <DrosiaMark className="mx-auto mb-5 h-[74px] w-auto text-muted opacity-50" />
        <h1 className="font-display text-[22px] font-black">{dict.tracking.notFoundTitle}</h1>
        <p className="mx-auto mt-2 max-w-[260px] text-[14px] leading-relaxed text-slate">
          {dict.tracking.notFoundBody}
        </p>
        <div className="mx-auto mt-6 max-w-[220px]">
          <ButtonLink href="/map" variant="primary">
            {dict.tracking.goToMap}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
