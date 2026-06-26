import { notFound } from "next/navigation";
import { ScorecardScreen } from "@/components/screens/ScorecardScreen";
import { getAuthorityPage } from "@/lib/authority";

/** Authority scorecard — /authority/<id>. Fair-by-design accountability page. */
export default async function AuthorityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getAuthorityPage(slug);
  if (!data) notFound();
  return <ScorecardScreen data={data} />;
}
