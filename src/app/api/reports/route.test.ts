import { afterEach, describe, expect, it, vi } from "vitest";

import { buildObservationCandidates } from "@/report/candidate-builder";
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

  it("returns provider prose only when every selected candidate is grounded", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "secret");
    const candidates = buildObservationCandidates(BASE_REPORT_INPUT);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary:
                    "The clearest tracked movements are ready to review.",
                  insights: candidates.map(({ id }) => ({
                    candidateId: id,
                    title: "Measured movement",
                    explanation: "The marked phases show a visible change.",
                    whyItMayMatter:
                      "This can support comparison with your own recordings.",
                    reviewAction:
                      "Compare the marked phases with the video overlay.",
                  })),
                }),
              },
            },
          ],
        }),
      ),
    );

    const response = await POST(request(BASE_REPORT_INPUT));
    const body = await response.json();
    expect(body.source).toBe("openrouter");
    expect(body.candidates).toEqual(candidates);
    expect(body.report.insights).toHaveLength(candidates.length);
  });

  it("uses the deterministic report after a provider failure", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "secret");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 429 })),
    );

    const response = await POST(request(BASE_REPORT_INPUT));
    const body = await response.json();
    expect(body.source).toBe("deterministic-fallback");
    expect(body.fallbackReason).toBe("provider-error");
  });
});

function request(body: unknown) {
  return new Request("http://localhost/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
