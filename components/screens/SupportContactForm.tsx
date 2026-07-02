"use client";

import { useState } from "react";
import { useLocale } from "@/components/LocaleProvider";

/** Contact address for supporters/partners. Env-configurable; defaults to info@drosia.eu. */
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "info@drosia.eu";

const ROLES = ["hotel", "municipality", "ngo", "local", "other"] as const;
type Role = (typeof ROLES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type FieldError = "name" | "email" | "role" | "message";

/**
 * Supporter first-contact form (public /support). Warm, low-friction: the form
 * is the primary CTA; the email address stays visible below as a backup. Posts
 * to /api/support-contact, which stores a durable lead and notifies the team.
 * No account, no tracking beyond the message the visitor chooses to send.
 */
export function SupportContactForm() {
  const { dict, locale } = useLocale();
  const S = dict.support;

  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [place, setPlace] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — real users never fill it
  const [errors, setErrors] = useState<Set<FieldError>>(new Set());
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const roleLabels: Record<Role, string> = {
    hotel: S.rHotel,
    municipality: S.rMuni,
    ngo: S.rNgo,
    local: S.rLocal,
    other: S.rOther,
  };

  function validate(): Set<FieldError> {
    const e = new Set<FieldError>();
    if (!name.trim()) e.add("name");
    if (!EMAIL_RE.test(email.trim())) e.add("email");
    if (!role) e.add("role");
    if (!message.trim()) e.add("message");
    return e;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (status === "sending") return;
    const e = validate();
    setErrors(e);
    if (e.size > 0) return;

    setStatus("sending");
    try {
      const res = await fetch("/api/support-contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          organisation: org.trim(),
          email: email.trim(),
          role,
          place: place.trim(),
          message: message.trim(),
          locale,
          website,
        }),
      });
      if (!res.ok) throw new Error("send failed");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-[18px] border border-success/30 bg-tint-soft p-6 text-center">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-success text-[20px] text-white">✓</div>
        <h3 className="mt-3 font-display text-[18px] font-black">{S.successTitle}</h3>
        <p className="mx-auto mt-1.5 max-w-[380px] text-[13px] leading-relaxed text-slate">{S.successBody}</p>
      </div>
    );
  }

  const inputClass = (field?: FieldError) =>
    `w-full rounded-[14px] border-[1.5px] bg-surface p-3 text-[14px] outline-none focus:border-primary ${
      field && errors.has(field) ? "border-severity-stale" : "border-line-strong"
    }`;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {/* Honeypot: hidden from users, catches naive bots. */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <Field label={S.fName} error={errors.has("name") ? S.errName : undefined}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 120))}
          className={inputClass("name")}
          autoComplete="name"
        />
      </Field>

      <Field label={S.fOrg} hint={S.optional}>
        <input
          value={org}
          onChange={(e) => setOrg(e.target.value.slice(0, 160))}
          className={inputClass()}
          autoComplete="organization"
        />
      </Field>

      <Field label={S.fEmail} error={errors.has("email") ? S.errEmail : undefined}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value.slice(0, 200))}
          className={inputClass("email")}
          autoComplete="email"
          inputMode="email"
        />
      </Field>

      <Field label={S.fRole} error={errors.has("role") ? S.errRole : undefined}>
        <select value={role} onChange={(e) => setRole(e.target.value as Role | "")} className={`${inputClass("role")} appearance-none`}>
          <option value="" disabled>
            {S.fRolePlaceholder}
          </option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabels[r]}
            </option>
          ))}
        </select>
      </Field>

      <Field label={S.fPlace} hint={S.optional}>
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value.slice(0, 200))}
          className={inputClass()}
          placeholder={S.fPlacePlaceholder}
        />
      </Field>

      <Field label={S.fMessage} error={errors.has("message") ? S.errMessage : undefined}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
          className={`${inputClass("message")} h-[120px] resize-none`}
        />
      </Field>

      {status === "error" && <p className="text-[13px] font-bold text-severity-stale">{S.errSend}</p>}

      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-1 rounded-[14px] bg-ink px-6 py-3.5 font-display text-[15px] font-extrabold text-ink-contrast disabled:opacity-60"
      >
        {status === "sending" ? S.formSending : S.formSubmit}
      </button>

      <p className="text-center text-[12px] text-muted">
        {S.backupEmail}{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-primary-ink">
          {CONTACT_EMAIL}
        </a>
      </p>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-1.5">
        <span className="text-[13px] font-bold text-ink">{label}</span>
        {hint && <span className="text-[11px] font-normal text-muted">· {hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-[12px] font-bold text-severity-stale">{error}</span>}
    </label>
  );
}
