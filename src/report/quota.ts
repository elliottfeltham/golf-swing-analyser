import { createHash, createHmac } from "node:crypto";

import { Redis } from "@upstash/redis";

import type { AnalysisReportInput, ReportResponse } from "./schema";

export const CUSTOMER_DAILY_LIMIT = 5;
const DEFAULT_GLOBAL_DAILY_LIMIT = 45;
const CACHE_TTL_SECONDS = 48 * 60 * 60;
const COUNTER_GRACE_SECONDS = 60 * 60;

const RESERVE_SCRIPT = `
local customerCount = tonumber(redis.call('GET', KEYS[1]) or '0')
local globalCount = tonumber(redis.call('GET', KEYS[2]) or '0')
local customerLimit = tonumber(ARGV[1])
local globalLimit = tonumber(ARGV[2])
local expiresAt = tonumber(ARGV[3])

if customerCount >= customerLimit then
  return {0, customerCount, globalCount, 1}
end
if globalCount >= globalLimit then
  return {0, customerCount, globalCount, 2}
end

customerCount = redis.call('INCR', KEYS[1])
globalCount = redis.call('INCR', KEYS[2])
if customerCount == 1 then redis.call('EXPIREAT', KEYS[1], expiresAt) end
if globalCount == 1 then redis.call('EXPIREAT', KEYS[2], expiresAt) end
return {1, customerCount, globalCount, 0}
`;

const RELEASE_CUSTOMER_SCRIPT = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count > 0 then return redis.call('DECR', KEYS[1]) end
return 0
`;

export type QuotaDenialReason = "customer-limit" | "global-limit";

export interface AllowanceStatus {
  limit: number;
  remaining: number;
  resetAt: string;
}

export interface QuotaReservation extends AllowanceStatus {
  allowed: boolean;
  reason?: QuotaDenialReason;
}

interface RedisClient {
  get<T>(key: string): Promise<T | null>;
  mget<T extends unknown[]>(...keys: string[]): Promise<T>;
  set<T>(key: string, value: T, options?: { ex?: number }): Promise<unknown>;
  eval<TArgs extends unknown[], TData = unknown>(
    script: string,
    keys: string[],
    args: TArgs,
  ): Promise<TData>;
}

export class ReportQuotaStore {
  constructor(
    private readonly redis: RedisClient,
    private readonly globalLimit = DEFAULT_GLOBAL_DAILY_LIMIT,
  ) {}

  async getAllowance(
    customerId: string,
    now = new Date(),
  ): Promise<AllowanceStatus> {
    const window = dailyWindow(now);
    const [customerValue] = await this.redis.mget<
      [number | null, number | null]
    >(
      customerCounterKey(customerId, window.dateKey),
      globalCounterKey(window.dateKey),
    );
    const used = Number(customerValue ?? 0);
    return {
      limit: CUSTOMER_DAILY_LIMIT,
      remaining: Math.max(0, CUSTOMER_DAILY_LIMIT - used),
      resetAt: window.resetAt.toISOString(),
    };
  }

  async reserve(
    customerId: string,
    now = new Date(),
  ): Promise<QuotaReservation> {
    const window = dailyWindow(now);
    const result = await this.redis.eval<
      [number, number, number],
      [number, number, number, number]
    >(
      RESERVE_SCRIPT,
      [
        customerCounterKey(customerId, window.dateKey),
        globalCounterKey(window.dateKey),
      ],
      [
        CUSTOMER_DAILY_LIMIT,
        this.globalLimit,
        Math.floor(window.resetAt.getTime() / 1_000) + COUNTER_GRACE_SECONDS,
      ],
    );
    const [allowed, customerCount, , reasonCode] = result.map(Number);
    return {
      allowed: allowed === 1,
      ...(reasonCode === 1
        ? { reason: "customer-limit" as const }
        : reasonCode === 2
          ? { reason: "global-limit" as const }
          : {}),
      limit: CUSTOMER_DAILY_LIMIT,
      remaining: Math.max(0, CUSTOMER_DAILY_LIMIT - (customerCount ?? 0)),
      resetAt: window.resetAt.toISOString(),
    };
  }

  async releaseCustomerReservation(customerId: string, now = new Date()) {
    const window = dailyWindow(now);
    await this.redis.eval(
      RELEASE_CUSTOMER_SCRIPT,
      [customerCounterKey(customerId, window.dateKey)],
      [],
    );
  }

  getCachedReport(analysisHash: string) {
    return this.redis.get<ReportResponse>(cacheKey(analysisHash));
  }

  async cacheReport(analysisHash: string, response: ReportResponse) {
    await this.redis.set(cacheKey(analysisHash), response, {
      ex: CACHE_TTL_SECONDS,
    });
  }
}

export function createReportQuotaStoreFromEnv(): ReportQuotaStore | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const configuredLimit = Number(process.env.REPORT_GLOBAL_DAILY_LIMIT);
  const globalLimit =
    Number.isInteger(configuredLimit) &&
    configuredLimit > 0 &&
    configuredLimit <= 1_000
      ? configuredLimit
      : DEFAULT_GLOBAL_DAILY_LIMIT;
  return new ReportQuotaStore(new Redis({ url, token }), globalLimit);
}

export function identifyCustomer(
  request: Request,
  secret: string,
  now = new Date(),
) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "local-or-unknown";
  const ip = forwarded.split(",")[0]!.trim();
  const dateKey = now.toISOString().slice(0, 10);
  return createHmac("sha256", secret).update(`${dateKey}:${ip}`).digest("hex");
}

export function hashAnalysis(input: AnalysisReportInput) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function nextUtcReset(now = new Date()) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
}

function dailyWindow(now: Date) {
  return {
    dateKey: now.toISOString().slice(0, 10),
    resetAt: nextUtcReset(now),
  };
}

function customerCounterKey(customerId: string, dateKey: string) {
  return `gsa:quota:customer:${dateKey}:${customerId}`;
}

function globalCounterKey(dateKey: string) {
  return `gsa:quota:global:${dateKey}`;
}

function cacheKey(analysisHash: string) {
  return `gsa:report:v1:${analysisHash}`;
}
