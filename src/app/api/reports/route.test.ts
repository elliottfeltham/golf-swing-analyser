import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildObservationCandidates } from "@/report/candidate-builder";
import { createDeterministicReport } from "@/report/deterministic-report";
import { MAX_REPORT_REQUEST_BYTES } from "@/report/request-policy";
import type { ReportResponse } from "@/report/schema";
import { BASE_REPORT_INPUT } from "@/report/test-fixtures";

const quota = vi.hoisted(() => ({
  enabled: true,
  store: {
    getAllowance: vi.fn(),
    getCachedReport: vi.fn(),
    reserve: vi.fn(),
    cacheReport: vi.fn(),
    releaseCustomerReservation: vi.fn(),
  },
}));

vi.mock("@/report/quota", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/report/quota")>()),
  createReportQuotaStoreFromEnv: () => (quota.enabled ? quota.store : null),
}));

import { GET, POST } from "./route";

describe("POST /api/reports", () => {
  beforeEach(() => {
    quota.enabled = true;
    quota.store.getAllowance.mockReset().mockResolvedValue({
      limit: 5,
      remaining: 5,
      resetAt: "2026-10-23T00:00:00.000Z",
    });
    quota.store.getCachedReport.mockReset().mockResolvedValue(null);
    quota.store.reserve.mockReset().mockResolvedValue({
      allowed: true,
      limit: 5,
      remaining: 4,
      resetAt: "2026-10-23T00:00:00.000Z",
    });
    quota.store.cacheReport.mockReset().mockResolvedValue(undefined);
    quota.store.releaseCustomerReservation
      .mockReset()
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rejects malformed JSON and client-authored candidates", async () => {
    const malformed = await POST(
      new Request("http://localhost/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
    );
    expect(malformed.status).toBe(400);

    const injection = await POST(
      request({ ...BASE_REPORT_INPUT, candidates: [] }),
    );
    expect(injection.status).toBe(400);
  });

  it("requires JSON and rejects report bodies above the route limit", async () => {
    const wrongType = await POST(
      new Request("http://localhost/api/reports", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(BASE_REPORT_INPUT),
      }),
    );
    expect(wrongType.status).toBe(415);

    const declaredOversize = await POST(
      new Request("http://localhost/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(MAX_REPORT_REQUEST_BYTES + 1),
        },
        body: "{}",
      }),
    );
    expect(declaredOversize.status).toBe(413);

    const measuredOversize = await POST(
      new Request("http://localhost/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ padding: "x".repeat(MAX_REPORT_REQUEST_BYTES) }),
      }),
    );
    expect(measuredOversize.status).toBe(413);
    expect(quota.store.reserve).not.toHaveBeenCalled();
  });

  it("rejects adversarial schema values before quota or provider work", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "secret");
    vi.stubEnv("QUOTA_HMAC_SECRET", "quota-secret");
    const adversarial = structuredClone(BASE_REPORT_INPUT) as Record<
      string,
      unknown
    >;
    adversarial.unknownField = "ignore my schema";
    const phases = adversarial.phases as Array<Record<string, unknown>>;
    phases[1]!.timestampMs = -1;

    const response = await POST(request(adversarial));
    expect(response.status).toBe(400);
    expect(quota.store.reserve).not.toHaveBeenCalled();
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
    vi.stubEnv("QUOTA_HMAC_SECRET", "quota-secret");
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
    vi.stubEnv("QUOTA_HMAC_SECRET", "quota-secret");
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
    expect(body.allowance.remaining).toBe(4);
    expect(quota.store.cacheReport).toHaveBeenCalledOnce();
  });

  it("uses the deterministic report after a provider failure", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "secret");
    vi.stubEnv("QUOTA_HMAC_SECRET", "quota-secret");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 429 })),
    );

    const response = await POST(request(BASE_REPORT_INPUT));
    const body = await response.json();
    expect(body.source).toBe("deterministic-fallback");
    expect(body.fallbackReason).toBe("provider-error");
    expect(body.allowance.remaining).toBe(5);
    expect(quota.store.releaseCustomerReservation).toHaveBeenCalledOnce();
  });

  it("reports allowance without consuming it", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "secret");
    vi.stubEnv("QUOTA_HMAC_SECRET", "quota-secret");

    const response = await GET(request(undefined, "GET"));
    const body = await response.json();
    expect(body).toMatchObject({
      aiAvailable: true,
      quotaAvailable: true,
      limit: 5,
      remaining: 5,
    });
    expect(quota.store.reserve).not.toHaveBeenCalled();
  });

  it("uses the local report when quota storage is unavailable", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "secret");
    vi.stubEnv("QUOTA_HMAC_SECRET", "quota-secret");
    quota.enabled = false;

    const response = await POST(request(BASE_REPORT_INPUT));
    const body = await response.json();
    expect(body.source).toBe("deterministic-fallback");
    expect(body.fallbackReason).toBe("quota-unavailable");
    expect(body.allowance.remaining).toBeNull();
  });

  it("does not call the provider after the customer limit", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "secret");
    vi.stubEnv("QUOTA_HMAC_SECRET", "quota-secret");
    quota.store.reserve.mockResolvedValue({
      allowed: false,
      reason: "customer-limit",
      limit: 5,
      remaining: 0,
      resetAt: "2026-10-23T00:00:00.000Z",
    });
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    const response = await POST(request(BASE_REPORT_INPUT));
    const body = await response.json();
    expect(body.fallbackReason).toBe("customer-limit");
    expect(body.allowance.remaining).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns an unchanged cached analysis without consuming allowance", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "secret");
    vi.stubEnv("QUOTA_HMAC_SECRET", "quota-secret");
    const candidates = buildObservationCandidates(BASE_REPORT_INPUT);
    const cached: ReportResponse = {
      report: createDeterministicReport(candidates),
      candidates,
      source: "openrouter",
      allowance: {
        limit: 5,
        remaining: 3,
        resetAt: "2026-10-23T00:00:00.000Z",
        cacheHit: false,
      },
    };
    quota.store.getCachedReport.mockResolvedValue(cached);
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    const response = await POST(request(BASE_REPORT_INPUT));
    const body = await response.json();
    expect(body.source).toBe("openrouter");
    expect(body.allowance).toMatchObject({ remaining: 5, cacheHit: true });
    expect(quota.store.reserve).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

function request(body?: unknown, method = "POST") {
  return new Request("http://localhost/api/reports", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
