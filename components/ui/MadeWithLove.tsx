"use client";

import { useLocale } from "@/components/LocaleProvider";

export function MadeWithLove({ className = "" }: { className?: string }) {
  const { dict } = useLocale();

  return (
    <p className={`flex items-center justify-center gap-1 ${className}`}>
      <span>{dict.footer.madeWith}</span>
      <span role="img" aria-label={dict.footer.love} className="text-[13px] leading-none">
        ❤️
      </span>
      <span>{dict.footer.inGreece}</span>
    </p>
  );
}
