import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import type { Locale } from "@/lib/i18n";

/**
 * Authority notification email — sent when a report is approved & delivered to
 * the responsible authority (see lib/providers/deliver.ts).
 *
 * Drosia "Morning Freshness" palette, inlined as static hex (email clients get
 * no globals.css / CSS variables). Kept light-only — email dark mode is
 * unreliable across clients. The copy is localized to the AUTHORITY's language,
 * not the admin UI. A matching plain-text part (authorityEmailText) always ships
 * alongside for deliverability + text-only clients.
 */

export type AuthorityReportProps = {
  locale: Locale;
  /** Already localized, human-readable category label (e.g. "Παράνομη χωματερή"). */
  categoryLabel: string;
  reportUrl: string;
};

type Copy = {
  brandSub: string;
  kicker: string;
  subtitle: string;
  categoryRow: string;
  privacyTitle: string;
  privacyBody: string;
  cta: string;
  orOpen: string;
  footerTagline: string;
  subject: (label: string) => string;
  text: (label: string, url: string) => string;
};

const COPY: Record<Locale, Copy> = {
  el: {
    brandSub: "Αναφορές πολιτών για το περιβάλλον",
    kicker: "ΝΕΑ ΑΝΑΦΟΡΑ ΠΟΛΙΤΗ",
    subtitle: "Μια νέα αναφορά πολίτη στην περιοχή αρμοδιότητάς σας χρειάζεται έλεγχο.",
    categoryRow: "Κατηγορία",
    privacyTitle: "Προστασία δεδομένων",
    privacyBody:
      "Η φωτογραφία είναι ανωνυμοποιημένη (πρόσωπα & πινακίδες θολωμένα). Δεν συλλέγουμε κανένα προσωπικό στοιχείο του πολίτη.",
    cta: "Προβολή αναφοράς",
    orOpen: "Ή ανοίξτε τον σύνδεσμο:",
    footerTagline: "Drosia · μόνο πραγματικά δεδομένα, κανένα προσωπικό στοιχείο.",
    subject: (label) => `Νέα αναφορά πολίτη: ${label}`,
    text: (label, url) =>
      `Νέα αναφορά πολίτη στην περιοχή σας (${label}).\nΑνωνυμοποιημένη φωτογραφία & τοποθεσία: ${url}\n\nDrosia · μόνο πραγματικά δεδομένα, κανένα προσωπικό στοιχείο.`,
  },
  de: {
    brandSub: "Bürgermeldungen für die Umwelt",
    kicker: "NEUE BÜRGERMELDUNG",
    subtitle: "Eine neue Bürgermeldung in Ihrem Zuständigkeitsbereich wartet auf Prüfung.",
    categoryRow: "Kategorie",
    privacyTitle: "Datenschutz",
    privacyBody:
      "Das Foto ist anonymisiert (Gesichter & Kennzeichen unkenntlich). Wir erheben keine personenbezogenen Daten der meldenden Person.",
    cta: "Meldung ansehen",
    orOpen: "Oder Link öffnen:",
    footerTagline: "Drosia · nur Fakten, keine personenbezogenen Daten.",
    subject: (label) => `Neue Bürgermeldung: ${label}`,
    text: (label, url) =>
      `Neue Bürgermeldung in Ihrem Gebiet (${label}).\nAnonymisiertes Foto & Standort: ${url}\n\nDrosia · nur Fakten, keine personenbezogenen Daten.`,
  },
  en: {
    brandSub: "Citizen reports for the environment",
    kicker: "NEW CITIZEN REPORT",
    subtitle: "A new citizen report in your area of responsibility needs review.",
    categoryRow: "Category",
    privacyTitle: "Data protection",
    privacyBody:
      "The photo is anonymized (faces & plates blurred). We collect no personal data about the reporter.",
    cta: "View report",
    orOpen: "Or open the link:",
    footerTagline: "Drosia · facts only, no personal data.",
    subject: (label) => `New citizen report: ${label}`,
    text: (label, url) =>
      `A new citizen report in your area (${label}).\nAnonymized photo & location: ${url}\n\nDrosia · facts only, no personal data.`,
  },
};

// ── Drosia "Morning Freshness" tokens (static, light-only) ────────────────────
const AQUA = "#00b4c8";
const AQUA_INK = "#00a6bc";
const INK = "#0b2b30";
const MUTED = "#5f7a7f";
const SLATE = "#5b7378";
const SURFACE = "#f7fbfc";
const CARD = "#ffffff";
const BORDER = "#e8f0f0";
const TINT = "#e0f3f5";
const TINT_SOFT = "#f0fafb";
const FONT = "'Mulish', 'Nunito', Arial, Helvetica, sans-serif";

export function authoritySubject(locale: Locale, categoryLabel: string): string {
  return COPY[locale].subject(categoryLabel);
}

export function authorityEmailText(locale: Locale, categoryLabel: string, url: string): string {
  return COPY[locale].text(categoryLabel, url);
}

export default function AuthorityReport({ locale, categoryLabel, reportUrl }: AuthorityReportProps) {
  const t = COPY[locale];

  return (
    <Html lang={locale}>
      <Head />
      <Preview>{t.subject(categoryLabel)}</Preview>
      <Body style={{ margin: 0, backgroundColor: SURFACE, fontFamily: FONT }}>
        <Container style={{ maxWidth: 560, margin: "32px auto", padding: "0 16px" }}>
          <Section
            style={{
              backgroundColor: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 18,
              overflow: "hidden",
            }}
          >
            {/* Brand accent bar */}
            <Section style={{ height: 4, backgroundColor: AQUA, lineHeight: "4px", fontSize: 0 }}>
              &nbsp;
            </Section>

            {/* Header */}
            <Section style={{ padding: "22px 28px 6px" }}>
              <Text style={{ margin: 0, color: INK, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
                Drosia
              </Text>
              <Text
                style={{
                  margin: "4px 0 0",
                  color: MUTED,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {t.brandSub}
              </Text>
            </Section>

            {/* Body */}
            <Section style={{ padding: "10px 28px 28px" }}>
              <Text style={{ margin: "0 0 6px", color: AQUA_INK, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.09em" }}>
                {t.kicker}
              </Text>
              <Heading as="h1" style={{ margin: "0 0 8px", color: INK, fontSize: 24, lineHeight: "1.25", fontWeight: 800 }}>
                {categoryLabel}
              </Heading>
              <Text style={{ margin: "0 0 20px", color: SLATE, fontSize: 14, lineHeight: "1.55" }}>
                {t.subtitle}
              </Text>

              {/* Category chip */}
              <Section
                style={{
                  backgroundColor: TINT_SOFT,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 14,
                  padding: "12px 16px",
                  marginBottom: 16,
                }}
              >
                <Text style={{ margin: 0, color: MUTED, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {t.categoryRow}
                </Text>
                <Text style={{ margin: "2px 0 0", color: INK, fontSize: 15, fontWeight: 700 }}>
                  {categoryLabel}
                </Text>
              </Section>

              {/* Privacy block — core to the Drosia promise */}
              <Section
                style={{
                  backgroundColor: TINT,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 14,
                  padding: "14px 16px",
                  marginBottom: 24,
                }}
              >
                <Text style={{ margin: "0 0 4px", color: INK, fontSize: 13, fontWeight: 800 }}>
                  🔒 {t.privacyTitle}
                </Text>
                <Text style={{ margin: 0, color: SLATE, fontSize: 13, lineHeight: "1.5" }}>
                  {t.privacyBody}
                </Text>
              </Section>

              {/* CTA */}
              <Button
                href={reportUrl}
                style={{
                  backgroundColor: INK,
                  color: "#ffffff",
                  padding: "13px 26px",
                  borderRadius: 14,
                  fontSize: 15,
                  fontWeight: 800,
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                {t.cta} →
              </Button>

              <Text style={{ margin: "18px 0 0", color: MUTED, fontSize: 13 }}>
                {t.orOpen}{" "}
                <Link href={reportUrl} style={{ color: AQUA_INK, wordBreak: "break-all" }}>
                  {reportUrl}
                </Link>
              </Text>
            </Section>

            {/* Footer */}
            <Hr style={{ borderColor: BORDER, margin: 0 }} />
            <Section style={{ backgroundColor: SURFACE, padding: "18px 28px", textAlign: "center" as const }}>
              <Text style={{ margin: 0, color: MUTED, fontSize: 12, lineHeight: "1.5" }}>
                {t.footerTagline}
              </Text>
              <Text style={{ margin: "6px 0 0", color: "#9fb6ba", fontSize: 11 }}>
                Drosia · login-free civic reporting · EU
              </Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
