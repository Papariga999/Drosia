import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adminAuthConfigured, checkPassword } from "@/lib/admin/session";
import { isMutationMethod, isSameOriginRequest } from "@/lib/admin/request-origin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin authentication configuration", () => {
  it("uses fixed-size password comparison and rejects the wrong password", () => {
    vi.stubEnv("ADMIN_PASSWORD", "a sufficiently long operator password");
    expect(checkPassword("a sufficiently long operator password")).toBe(true);
    expect(checkPassword("wrong")).toBe(false);
  });

  it("accepts an existing short password but rejects placeholders and requires an independent session secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_PASSWORD", "CHANGE_ME");
    vi.stubEnv("ADMIN_SESSION_SECRET", "independent-session-secret-at-least-thirty-two-chars");
    expect(adminAuthConfigured()).toBe(false);

    vi.stubEnv("ADMIN_PASSWORD", "hunter2");
    expect(adminAuthConfigured()).toBe(true);

    vi.stubEnv("ADMIN_SESSION_SECRET", "short");
    vi.stubEnv("WEBHOOK_SECRET", "this-webhook-secret-must-not-be-an-admin-fallback");
    expect(adminAuthConfigured()).toBe(false);

    vi.stubEnv("ADMIN_SESSION_SECRET", "independent-session-secret-at-least-thirty-two-chars");
    expect(adminAuthConfigured()).toBe(true);
  });
});

describe("admin CSRF origin guard", () => {
  it("accepts a same-origin browser mutation", () => {
    const req = new Request("https://drosia.example/api/admin/reports/approve", {
      method: "POST",
      headers: { origin: "https://drosia.example", "sec-fetch-site": "same-origin" },
    });
    expect(isMutationMethod(req.method)).toBe(true);
    expect(isSameOriginRequest(req)).toBe(true);
  });

  it("rejects cross-origin and same-site sibling requests", () => {
    for (const fetchSite of ["cross-site", "same-site"]) {
      const req = new Request("https://drosia.example/api/admin/reports/approve", {
        method: "POST",
        headers: { origin: "https://evil.drosia.example", "sec-fetch-site": fetchSite },
      });
      expect(isSameOriginRequest(req)).toBe(false);
    }
  });

  it("keeps non-browser operator clients possible while auth remains mandatory", () => {
    expect(
      isSameOriginRequest(new Request("https://drosia.example/api/admin/tasks", { method: "DELETE" })),
    ).toBe(true);
  });
});

describe("Next.js 16 admin gate", () => {
  it("uses proxy.ts and removes the deprecated middleware convention", () => {
    const root = process.cwd();
    expect(existsSync(join(root, "proxy.ts"))).toBe(true);
    expect(existsSync(join(root, "middleware.ts"))).toBe(false);
    const source = readFileSync(join(root, "proxy.ts"), "utf8");
    expect(source).toMatch(/export async function proxy/);
    expect(source).toMatch(/isSameOriginRequest/);
  });
});

describe("worldwide report approval", () => {
  it("forces the no-email path when no authority is routed", () => {
    const source = readFileSync(
      join(process.cwd(), "app", "api", "admin", "reports", "approve", "route.ts"),
      "utf8",
    );
    expect(source).toMatch(/select\("id, status, authority_id"\)/);
    expect(source).toMatch(/notifyRequested\s*&&\s*report\.authority_id\s*!==\s*null/);
  });
});
