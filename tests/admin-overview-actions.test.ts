import { describe, expect, it } from "vitest";
import { reportOverviewActions } from "@/lib/admin/report-actions";

describe("admin report overview quick actions", () => {
  it("offers moderation actions for submitted reports", () => {
    expect(reportOverviewActions("submitted")).toEqual({
      approve: true,
      reject: true,
      edit: true,
      delete: true,
    });
  });

  it.each(["in_review", "notified", "resolved", "rejected"])(
    "keeps edit/delete but hides completed moderation actions for %s reports",
    (status) => {
      expect(reportOverviewActions(status)).toEqual({
        approve: false,
        reject: false,
        edit: true,
        delete: true,
      });
    },
  );
});
