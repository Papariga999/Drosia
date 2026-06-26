import { ImpactScreen } from "@/components/screens/ImpactScreen";
import { getDeviceImpact } from "@/lib/me";

/**
 * My impact — /me/<token>. The token addresses an anonymous device identity,
 * not an account. Reads the device's own reports by author_token.
 */
export default async function TokenImpactPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const impact = await getDeviceImpact(token);
  return <ImpactScreen impact={impact} />;
}
