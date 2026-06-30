import type { Metadata } from "next";
import { SupportScreen } from "@/components/screens/SupportScreen";

export const metadata: Metadata = {
  title: "Support Drosia",
  description: "Organisations that share our goal can help carry Drosia — hotels & tourism, municipalities, NGOs & environmental groups.",
};

/** Supporters / partners — /support. Static info page linked from the landing CTA. */
export default function SupportPage() {
  return <SupportScreen />;
}
