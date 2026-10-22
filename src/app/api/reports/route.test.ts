import { afterEach, describe, expect, it, vi } from "vitest";

import { BASE_REPORT_INPUT } from "@/report/test-fixtures";
import { POST } from "./route";

describe("POST /api/reports", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rejects malformed JSON and client-authored candidates", async () => {
    const malformed = await POST(
      new Request("http://localhost/api/reports", {
        method: "POST",
        body: "not json",
      }),
    );
    expect(malformed.status).toBe(400);

    const injection = await POST(
      request({ ...BASE_REPORT_INPUT, candidates: [] }),
    );
    expect(injection.status).toBe(400);
  });

  it("returns grounded candidates with a deterministic fallback when unconfigured", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const response = await POST(request(BASE_REPORT_INPUT));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("deterministic-fallback");
    expect(body.fallbackReason).toBe("not-configured");
    expect(body.candidates).toHaveLength(3);
    expect(body.report.insights[0].candidateId).toBe(body.candidates[0].id);
  });

  it("falls back when the provider returns ungrounded output", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "secret");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: "Your clubhead speed is one hundred miles per hour.",
                  insights: [],
                }),
              },
            },
          ],
        }),
      ),
    );

    const response = await POST(request(BASE_REPORT_INPUT));
    const body = await response.json();
    expect(body.source).toBe("deterministic-fallback");
    expect(body.fallbackReason).toBe("invalid-response");
  });
});

function request(body: unknown) {
  return new Request("http://localhost/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
