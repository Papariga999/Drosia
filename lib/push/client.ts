"use client";

import { getDeviceToken } from "@/lib/device-token";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type FollowResult = "followed" | "denied" | "unsupported" | "error";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** True only when this browser can register a push follow AND a VAPID key exists. */
export function canFollow(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!VAPID_PUBLIC_KEY
  );
}

/**
 * Subscribe this browser to Web-Push updates for a single report. Registers the
 * service worker, asks permission, creates the PushManager subscription and
 * records the follow server-side, keyed by the anonymous device token. No email,
 * no account. Returns a status the UI can reflect.
 */
export async function followReport(reportToken: string): Promise<FollowResult> {
  if (!canFollow()) return "unsupported";
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY as string),
      });
    }

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceToken: getDeviceToken(),
        subscription: sub.toJSON(),
        reportToken,
      }),
    });
    return res.ok ? "followed" : "error";
  } catch {
    return "error";
  }
}
