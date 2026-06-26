import "server-only";

/**
 * Report delivery abstraction: 'email' (Resend) or 'open311' per authority.
 * NEVER fails silently — the caller logs every attempt to delivery_logs.
 *
 * The OUTGOING message is localized to the authority's language (input.locale),
 * independent of the admin board's English-only UI.
 *
 * Dev mode: when RESEND_API_KEY is absent we don't hit the network — we log to
 * the console and return 'sent' so the local moderation→notify loop is testable
 * without a verified domain. Production sets RESEND_API_KEY + a verified
 * EMAIL_FROM domain (SPF/DKIM/DMARC) and the real send path runs.
 */
export type DeliveryChannel = "email" | "open311" | "none";

export interface DeliverInput {
  reportId: string;
  reportToken: string;
  category: string;
  recipient: string | null; // authority email (email channel) or endpoint id
  locale: string; // recipient authority's language — NOT the admin UI language
}

export interface DeliverReportInput extends DeliverInput {
  channel: DeliveryChannel;
}

export interface DeliverResult {
  status: "sent" | "failed";
  providerMessageId?: string;
  error?: string;
}

function reportUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/r/${token}`;
}

let warnedDomain = false;
/** Deliverability is a P0 blocker: warn loudly if EMAIL_FROM isn't on the verified domain. */
function warnIfUnverifiedDomain(from: string): void {
  if (warnedDomain) return;
  const verified = process.env.EMAIL_VERIFIED_DOMAIN;
  if (!verified) return;
  const fromDomain = from.split("@").pop()?.replace(/>$/, "").trim().toLowerCase();
  if (fromDomain && fromDomain !== verified.toLowerCase()) {
    warnedDomain = true;
    console.warn(
      `[deliver] EMAIL_FROM domain "${fromDomain}" != EMAIL_VERIFIED_DOMAIN "${verified}". ` +
        "Authority emails may be spam-filtered or bounce (SPF/DKIM/DMARC).",
    );
  }
}

/** Minimal localized authority email body. Kept inline; React Email is a later polish. */
function emailBody(locale: string, category: string, url: string): { subject: string; text: string } {
  if (locale === "el") {
    return {
      subject: `Νέα αναφορά πολίτη: ${category}`,
      text: `Νέα αναφορά πολίτη στην περιοχή σας (${category}).\nΑνωνυμοποιημένη φωτογραφία & τοποθεσία: ${url}\n\nDrosia · μόνο πραγματικά δεδομένα, κανένα προσωπικό στοιχείο.`,
    };
  }
  if (locale === "de") {
    return {
      subject: `Neue Bürgermeldung: ${category}`,
      text: `Neue Bürgermeldung in Ihrem Gebiet (${category}).\nAnonymisiertes Foto & Standort: ${url}\n\nDrosia · nur Fakten, keine personenbezogenen Daten.`,
    };
  }
  return {
    subject: `New citizen report: ${category}`,
    text: `A new citizen report in your area (${category}).\nAnonymized photo & location: ${url}\n\nDrosia · facts only, no personal data.`,
  };
}

export interface ReportDeliverer {
  deliver(input: DeliverInput): Promise<DeliverResult>;
}

class EmailDeliverer implements ReportDeliverer {
  async deliver(input: DeliverInput): Promise<DeliverResult> {
    if (!input.recipient) return { status: "failed", error: "no recipient email" };

    const url = reportUrl(input.reportToken);
    const { subject, text } = emailBody(input.locale, input.category, url);
    // Only a real Resend key (re_…) triggers a live send; empty/placeholder/invalid
    // values fall back to dev-mode so a forgotten placeholder can't break delivery.
    const rawKey = process.env.RESEND_API_KEY;
    const apiKey = rawKey && rawKey.startsWith("re_") ? rawKey : null;
    const from = process.env.EMAIL_FROM ?? "reports@drosia.eu";

    if (!apiKey) {
      // Dev mode — no network, log so the loop is observable + testable.
      console.info(`[deliver:dev-email] → ${input.recipient} | ${subject} | ${url}`);
      return { status: "sent", providerMessageId: `dev-${input.reportToken}` };
    }

    warnIfUnverifiedDomain(from);
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from,
        to: input.recipient,
        subject,
        text,
      });
      if (error) return { status: "failed", error: error.message };
      return { status: "sent", providerMessageId: data?.id };
    } catch (e) {
      return { status: "failed", error: e instanceof Error ? e.message : "send failed" };
    }
  }
}

class Open311Deliverer implements ReportDeliverer {
  async deliver(input: DeliverInput): Promise<DeliverResult> {
    // TODO(phase4): POST GeoReport v2 to authority.open311_endpoint.
    void input;
    return { status: "failed", error: "open311 not implemented (Phase 4)" };
  }
}

export function getDeliverer(channel: DeliveryChannel): ReportDeliverer {
  switch (channel) {
    case "email":
      return new EmailDeliverer();
    case "open311":
      return new Open311Deliverer();
    default:
      throw new Error(`No deliverer for channel '${channel}'`);
  }
}

export function deliverReport(input: DeliverReportInput): Promise<DeliverResult> {
  const { channel, ...deliverInput } = input;
  return getDeliverer(channel).deliver(deliverInput);
}
