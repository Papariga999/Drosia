import type { Metadata } from "next";
import { LegalScreen } from "@/components/screens/LegalScreen";

export const metadata: Metadata = {
  title: "Privacy · Drosia",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <LegalScreen doc="privacy" />;
}
