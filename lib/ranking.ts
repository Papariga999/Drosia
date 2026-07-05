/**
 * Fairness threshold (CLAUDE.md §2.5): an authority enters the public ranking
 * only once it has ≥ this many DELIVERED reports. Shared by server aggregates
 * (lib/stats) and the client ranking-progress module — keep it dependency-free
 * so client components can import it without pulling in server-only code.
 */
export const RANKING_THRESHOLD = 10;
