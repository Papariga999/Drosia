import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "success" | "outline" | "disabled";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-white shadow-btn hover:brightness-105",
  success: "bg-success text-white hover:brightness-105",
  outline: "bg-surface-card text-primary-ink border-2 border-primary hover:bg-tint",
  disabled: "bg-line text-muted cursor-not-allowed",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-btn px-4 py-3.5 font-display font-extrabold text-[15px] transition-all w-full";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button
      className={`${base} ${VARIANTS[variant]} ${className}`}
      disabled={variant === "disabled" || props.disabled}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  className = "",
  href,
  children,
}: {
  variant?: Variant;
  className?: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${base} ${VARIANTS[variant]} ${className}`}>
      {children}
    </Link>
  );
}
