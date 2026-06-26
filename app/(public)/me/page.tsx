"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ImpactScreen } from "@/components/screens/ImpactScreen";
import { getDeviceToken } from "@/lib/device-token";

/**
 * My impact — /me. Resolves this browser's anonymous device token and redirects
 * to /me/<token> (which reads the device's own reports). No token yet → empty.
 */
export default function MePage() {
  const router = useRouter();
  useEffect(() => {
    const token = getDeviceToken();
    if (token) router.replace(`/me/${token}`);
  }, [router]);

  return <ImpactScreen impact={{ reported: 0, resolved: 0, confirms: 0, mine: [] }} />;
}
