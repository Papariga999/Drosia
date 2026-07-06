import type { Metadata } from "next";
import { LegalScreen } from "@/components/screens/LegalScreen";

export const metadata: Metadata = {
  title: "Legal notice · Drosia",
  alternates: { canonical: "/imprint" },
};

export default function ImprintPage() {
  return <LegalScreen doc="imprint" />;
}
