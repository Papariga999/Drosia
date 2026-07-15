import { VoteBar } from "drosia";

/** Priority 👍 + "still here" 🔴 vote pair with the social-proof line. */
export function Default() {
  return (
    <div style={{ width: 360 }}>
      <VoteBar
        token="r_9f3k2m"
        initialVotes={12}
        initialConfirms={3}
        importantLabel="Important"
        stillHereLabel="Still here"
        socialProof={(n) => `${n} neighbours marked this as important`}
      />
    </div>
  );
}

/** Fresh report, nothing voted yet. */
export function Empty() {
  return (
    <div style={{ width: 360 }}>
      <VoteBar
        token="r_2b8x1q"
        initialVotes={0}
        initialConfirms={0}
        importantLabel="Important"
        stillHereLabel="Still here"
        socialProof={(n) => `${n} neighbours marked this as important`}
      />
    </div>
  );
}
