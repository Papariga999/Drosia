"use client";

import { useState } from "react";

/**
 * 👍 "Important" + 🔴 "Still here" buttons. Optimistic increment with a
 * 240ms scale-bounce; real impl dedupes per device token. Social-proof
 * line below reflects the priority votes.
 */
export function VoteBar({
  initialVotes,
  initialConfirms,
  importantLabel,
  stillHereLabel,
  socialProof,
}: {
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

  return (
    <div>
      <div className="flex gap-3">
        <button
          onClick={() => {
            if (voted) return;
            setVotes((v) => v + 1);
            setVoted(true);
          }}
          className="flex-1 rounded-2xl border-2 border-primary bg-tint px-3 py-3.5 text-center transition-transform active:scale-95"
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
            setConfirms((c) => c + 1);
            setConfirmed(true);
          }}
          className="flex-1 rounded-2xl border-2 px-3 py-3.5 text-center transition-transform active:scale-95"
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
