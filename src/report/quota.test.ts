import { describe, expect, it, vi } from "vitest";

import {
  CUSTOMER_DAILY_LIMIT,
  hashAnalysis,
  identifyCustomer,
  nextUtcReset,
  ReportQuotaStore,
} from "./quota";
import { BASE_REPORT_INPUT } from "./test-fixtures";

describe("ReportQuotaStore", () => {
  it("reports the remaining customer allowance", async () => {
    const redis = fakeRedis();
    redis.mget.mockResolvedValue([2, 12]);
    const store = new ReportQuotaStore(redis);

    await expect(
      store.getAllowance("customer", new Date("2026-10-22T12:00:00Z")),
    ).resolves.toEqual({
      limit: CUSTOMER_DAILY_LIMIT,
      remaining: 3,
      resetAt: "2026-10-23T00:00:00.000Z",
    });
  });

  it.each([
    [[1, 3, 10, 0], { allowed: true, remaining: 2 }],
    [[0, 5, 10, 1], { allowed: false, remaining: 0, reason: "customer-limit" }],
    [[0, 2, 45, 2], { allowed: false, remaining: 3, reason: "global-limit" }],
  ] as const)("maps an atomic reservation result", async (result, expected) => {
    const redis = fakeRedis();
    redis.eval.mockResolvedValue(result);
    const store = new ReportQuotaStore(redis);

    await expect(
      store.reserve("customer", new Date("2026-10-22T12:00:00Z")),
    ).resolves.toMatchObject(expected);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        expect.stringContaining("customer"),
        expect.stringContaining("global"),
      ]),
      [5, 45, 1_792_717_200],
    );
  });

  it("stores cached reports for forty-eight hours", async () => {
    const redis = fakeRedis();
    const store = new ReportQuotaStore(redis);
    const response = { source: "openrouter" } as never;

    await store.cacheReport("hash", response);
    expect(redis.set).toHaveBeenCalledWith("gsa:report:v1:hash", response, {
      ex: 172_800,
    });
  });
});

describe("anonymous report identity", () => {
  it("creates a stable HMAC without returning the IP", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.1" },
    });
    const first = identifyCustomer(
      request,
      "secret",
      new Date("2026-10-22T12:00:00Z"),
    );
    const second = identifyCustomer(
      request,
      "secret",
      new Date("2026-10-22T22:00:00Z"),
    );

    expect(first).toBe(second);
    expect(first).not.toContain("203.0.113.8");
    expect(
      identifyCustomer(
        request,
        "another-secret",
        new Date("2026-10-22T12:00:00Z"),
      ),
    ).not.toBe(first);
    expect(
      identifyCustomer(request, "secret", new Date("2026-10-23T12:00:00Z")),
    ).not.toBe(first);
  });

  it("hashes identical reduced analyses consistently", () => {
    expect(hashAnalysis(BASE_REPORT_INPUT)).toBe(
      hashAnalysis(structuredClone(BASE_REPORT_INPUT)),
    );
  });

  it("resets at the next UTC midnight", () => {
    expect(nextUtcReset(new Date("2026-10-22T23:59:59Z")).toISOString()).toBe(
      "2026-10-23T00:00:00.000Z",
    );
  });
});

function fakeRedis() {
  return {
    get: vi.fn(),
    mget: vi.fn(),
    set: vi.fn(),
    eval: vi.fn(),
  };
}
