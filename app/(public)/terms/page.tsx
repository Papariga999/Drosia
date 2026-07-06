import type { Metadata } from "next";
import { LegalScreen } from "@/components/screens/LegalScreen";

export const metadata: Metadata = {
  title: "Terms · Drosia",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return <LegalScreen doc="terms" />;
}
