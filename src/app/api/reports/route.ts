import { NextResponse } from "next/server";

import { buildObservationCandidates } from "@/report/candidate-builder";
import { createDeterministicReport } from "@/report/deterministic-report";
import {
  InvalidReportResponseError,
  requestOpenRouterReport,
} from "@/report/openrouter";
import {
  AnalysisReportInputSchema,
  type ReportResponse,
} from "@/report/schema";

export async function POST(request: Request) {
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

  const fallbackReport = createDeterministicReport(candidates);
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    const response: ReportResponse = {
      report: fallbackReport,
      candidates,
      source: "deterministic-fallback",
      fallbackReason: "not-configured",
    };
    return NextResponse.json(response);
  }

  try {
    const report = await requestOpenRouterReport(candidates, apiKey);
    const response: ReportResponse = {
      report,
      candidates,
      source: "openrouter",
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("OpenRouter report generation failed", error);
    const response: ReportResponse = {
      report: fallbackReport,
      candidates,
      source: "deterministic-fallback",
      fallbackReason:
        error instanceof InvalidReportResponseError
          ? "invalid-response"
          : "provider-error",
    };
    return NextResponse.json(response);
  }
}
