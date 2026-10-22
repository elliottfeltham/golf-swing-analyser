import { NextResponse } from "next/server";

import { buildObservationCandidates } from "@/report/candidate-builder";
import { createDeterministicReport } from "@/report/deterministic-report";
import {
  InvalidReportResponseError,
  requestOpenRouterReport,
} from "@/report/openrouter";
import {
  CUSTOMER_DAILY_LIMIT,
  createReportQuotaStoreFromEnv,
  hashAnalysis,
  identifyCustomer,
  nextUtcReset,
  type AllowanceStatus,
  type ReportQuotaStore,
} from "@/report/quota";
import {
  AnalysisReportInputSchema,
  type ReportAllowanceResponse,
  type ReportResponse,
} from "@/report/schema";

interface ReportRouteDependencies {
  createQuotaStore: () => ReportQuotaStore | null;
  generateReport: typeof requestOpenRouterReport;
  now: () => Date;
}

function createReportHandlers(
  overrides: Partial<ReportRouteDependencies> = {},
) {
  const dependencies: ReportRouteDependencies = {
    createQuotaStore: createReportQuotaStoreFromEnv,
    generateReport: requestOpenRouterReport,
    now: () => new Date(),
    ...overrides,
  };

  return {
    GET: (request: Request) => getAllowance(request, dependencies),
    POST: (request: Request) => createReport(request, dependencies),
  };
}

const handlers = createReportHandlers();
export const GET = handlers.GET;
export const POST = handlers.POST;

async function getAllowance(
  request: Request,
  dependencies: ReportRouteDependencies,
) {
  const now = dependencies.now();
  const unavailable: ReportAllowanceResponse = {
    aiAvailable: Boolean(process.env.OPENROUTER_API_KEY),
    quotaAvailable: false,
    limit: CUSTOMER_DAILY_LIMIT,
    remaining: null,
    resetAt: nextUtcReset(now).toISOString(),
  };
  const context = quotaContext(request, dependencies);
  if (!context) return NextResponse.json(unavailable);

  try {
    const allowance = await context.store.getAllowance(context.customerId, now);
    return NextResponse.json({
      aiAvailable: Boolean(process.env.OPENROUTER_API_KEY),
      quotaAvailable: true,
      ...allowance,
    } satisfies ReportAllowanceResponse);
  } catch (error) {
    console.error("Report allowance lookup failed", error);
    return NextResponse.json(unavailable);
  }
}

async function createReport(
  request: Request,
  dependencies: ReportRouteDependencies,
) {
  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsedInput = AnalysisReportInputSchema.safeParse(requestBody);
  if (!parsedInput.success) {
    return NextResponse.json(
      {
        error: "Report input is invalid.",
        details: parsedInput.error.flatten(),
      },
      { status: 400 },
    );
  }

  const candidates = buildObservationCandidates(parsedInput.data);
  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "No reliable report observations could be produced." },
      { status: 422 },
    );
  }

  const now = dependencies.now();
  const fallbackReport = createDeterministicReport(candidates);
  const apiKey = process.env.OPENROUTER_API_KEY;
  const unavailableAllowance = {
    limit: CUSTOMER_DAILY_LIMIT,
    remaining: null,
    resetAt: nextUtcReset(now).toISOString(),
    cacheHit: false,
  };

  if (!apiKey) {
    return NextResponse.json({
      report: fallbackReport,
      candidates,
      source: "deterministic-fallback",
      fallbackReason: "not-configured",
      allowance: unavailableAllowance,
    } satisfies ReportResponse);
  }

  const context = quotaContext(request, dependencies);
  if (!context) {
    return NextResponse.json({
      report: fallbackReport,
      candidates,
      source: "deterministic-fallback",
      fallbackReason: "quota-unavailable",
      allowance: unavailableAllowance,
    } satisfies ReportResponse);
  }

  const analysisHash = hashAnalysis(parsedInput.data);
  let allowance: AllowanceStatus;
  try {
    allowance = await context.store.getAllowance(context.customerId, now);
    const cached = await context.store.getCachedReport(analysisHash);
    if (cached?.source === "openrouter") {
      return NextResponse.json({
        ...cached,
        allowance: { ...allowance, cacheHit: true },
      } satisfies ReportResponse);
    }
  } catch (error) {
    console.error("Report cache lookup failed", error);
    return NextResponse.json({
      report: fallbackReport,
      candidates,
      source: "deterministic-fallback",
      fallbackReason: "quota-unavailable",
      allowance: unavailableAllowance,
    } satisfies ReportResponse);
  }

  let reservation;
  try {
    reservation = await context.store.reserve(context.customerId, now);
  } catch (error) {
    console.error("Report quota reservation failed", error);
    return NextResponse.json({
      report: fallbackReport,
      candidates,
      source: "deterministic-fallback",
      fallbackReason: "quota-unavailable",
      allowance: unavailableAllowance,
    } satisfies ReportResponse);
  }

  if (!reservation.allowed) {
    return NextResponse.json({
      report: fallbackReport,
      candidates,
      source: "deterministic-fallback",
      fallbackReason: reservation.reason,
      allowance: { ...reservation, cacheHit: false },
    } satisfies ReportResponse);
  }

  try {
    const report = await dependencies.generateReport(candidates, apiKey);
    const response: ReportResponse = {
      report,
      candidates,
      source: "openrouter",
      allowance: { ...reservation, cacheHit: false },
    };
    try {
      await context.store.cacheReport(analysisHash, response);
    } catch (error) {
      console.error("Generated report could not be cached", error);
    }
    return NextResponse.json(response);
  } catch (error) {
    console.error("OpenRouter report generation failed", error);
    try {
      await context.store.releaseCustomerReservation(context.customerId, now);
    } catch (releaseError) {
      console.error(
        "Customer quota reservation could not be released",
        releaseError,
      );
    }
    return NextResponse.json({
      report: fallbackReport,
      candidates,
      source: "deterministic-fallback",
      fallbackReason:
        error instanceof InvalidReportResponseError
          ? "invalid-response"
          : "provider-error",
      allowance: {
        ...reservation,
        remaining: Math.min(reservation.limit, reservation.remaining + 1),
        cacheHit: false,
      },
    } satisfies ReportResponse);
  }
}

function quotaContext(request: Request, dependencies: ReportRouteDependencies) {
  const store = dependencies.createQuotaStore();
  const secret = process.env.QUOTA_HMAC_SECRET;
  if (!store || !secret) return null;
  return { store, customerId: identifyCustomer(request, secret) };
}
