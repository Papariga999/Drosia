"use client";

import { useState } from "react";
import { getDeviceToken } from "@/lib/device-token";

/**
 * 👍 "Important" + 🔴 "Still here" buttons. Optimistic increment, then POST to
 * /api/vote with the anonymous device token (server dedupes per device per type
 * via a UNIQUE constraint). On failure we revert; on success we sync to the
 * server's authoritative counts. Social-proof line reflects priority votes.
 */
export function VoteBar({
  token,
  initialVotes,
  initialConfirms,
  importantLabel,
  stillHereLabel,
  socialProof,
}: {
  token?: string;
  initialVotes: number;
  initialConfirms: number;
  importantLabel: string;
  stillHereLabel: string;
  socialProof: (n: number) => string;
}) {
  const [votes, setVotes] = useState(initialVotes);
  const [confirms, setConfirms] = useState(initialConfirms);
  const [voted, setVoted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function cast(type: "priority" | "still_here") {
    if (busy || !token) return;
    setBusy(true);
    const isPriority = type === "priority";
    // Optimistic.
    if (isPriority) {
      setVotes((v) => v + 1);
      setVoted(true);
    } else {
      setConfirms((c) => c + 1);
      setConfirmed(true);
    }
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, type, voterToken: getDeviceToken() }),
      });
      if (!res.ok) throw new Error("vote failed");
      const data = (await res.json()) as { vote_count?: number; confirm_count?: number };
      if (typeof data.vote_count === "number") setVotes(data.vote_count);
      if (typeof data.confirm_count === "number") setConfirms(data.confirm_count);
    } catch {
      // Revert the optimistic bump.
      if (isPriority) {
        setVotes((v) => Math.max(0, v - 1));
        setVoted(false);
      } else {
        setConfirms((c) => Math.max(0, c - 1));
        setConfirmed(false);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex gap-3">
        <button
          onClick={() => {
            if (voted) return;
            void cast("priority");
          }}
          disabled={voted || busy}
          className="flex-1 rounded-2xl border-2 border-primary bg-tint px-3 py-3.5 text-center transition-transform active:scale-95 disabled:opacity-70"
        >
          <div className="text-2xl leading-none">👍</div>
          <div className="tnum mt-1 font-display text-[28px] font-black text-primary-ink">
            {votes}
          </div>
          <div className="text-[12px] font-bold text-slate">{importantLabel}</div>
        </button>
        <button
          onClick={() => {
            if (confirmed) return;
            void cast("still_here");
          }}
          disabled={confirmed || busy}
          className="flex-1 rounded-2xl border-2 px-3 py-3.5 text-center transition-transform active:scale-95 disabled:opacity-70"
          style={{ borderColor: "var(--sev-stale)", backgroundColor: "#FDECEA" }}
        >
          <div className="text-2xl leading-none">🔴</div>
          <div
            className="tnum mt-1 font-display text-[28px] font-black"
            style={{ color: "#C0392B" }}
          >
            {confirms}
          </div>
          <div className="text-[12px] font-bold text-slate">{stillHereLabel}</div>
        </button>
      </div>
      <p className="mt-3 text-center text-[13px] text-slate">{socialProof(votes)}</p>
    </div>
  );
}
