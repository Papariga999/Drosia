import { describe, expect, it } from "vitest";
import {
  readJsonBody,
  readMultipartFormData,
} from "@/lib/http-body";

describe("bounded request body parsing", () => {
  it("accepts a small JSON object", async () => {
    const req = new Request("https://drosia.eu/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });
    await expect(readJsonBody(req, 1024)).resolves.toEqual({ ok: true });
  });

  it("rejects oversized bodies even without relying on Content-Length", async () => {
    const req = new Request("https://drosia.eu/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(100) }),
    });
    await expect(readJsonBody(req, 16)).rejects.toMatchObject({ status: 413 });
  });

  it("rejects non-object JSON and the wrong media type", async () => {
    const arrayReq = new Request("https://drosia.eu/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "[]",
    });
    await expect(readJsonBody(arrayReq)).rejects.toMatchObject({ status: 400 });

    const textReq = new Request("https://drosia.eu/api/test", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    await expect(readJsonBody(textReq)).rejects.toMatchObject({ status: 415 });
  });

  it("parses multipart only after enforcing the total byte limit", async () => {
    const form = new FormData();
    form.set("field", "value");
    const accepted = new Request("https://drosia.eu/api/test", { method: "POST", body: form });
    await expect(readMultipartFormData(accepted, 4096)).resolves.toBeInstanceOf(FormData);

    const large = new FormData();
    large.set("field", "x".repeat(4096));
    const rejected = new Request("https://drosia.eu/api/test", { method: "POST", body: large });
    await expect(readMultipartFormData(rejected, 128)).rejects.toMatchObject({ status: 413 });
  });
});
