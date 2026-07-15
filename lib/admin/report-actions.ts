/**
 * Action availability shared by the report overview UI and its tests.
 * Approval and rejection belong to the submitted moderation stage; edit and
 * permanent delete remain operator tools for every lifecycle state.
 */
export function reportOverviewActions(status: string) {
  const isPending = status === "submitted";
  return {
    approve: isPending,
    reject: isPending,
    edit: true,
    delete: true,
  } as const;
}
