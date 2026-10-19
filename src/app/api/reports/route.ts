import { NextResponse } from "next/server";

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

  const fallbackReport = createDeterministicReport(parsedInput.data);
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    const response: ReportResponse = {
      report: fallbackReport,
      source: "deterministic-fallback",
      fallbackReason: "not-configured",
    };
    return NextResponse.json(response);
  }

  try {
    const report = await requestOpenRouterReport(parsedInput.data, apiKey);
    const response: ReportResponse = { report, source: "openrouter" };
    return NextResponse.json(response);
  } catch (error) {
    console.error("OpenRouter report generation failed", error);
    const response: ReportResponse = {
      report: fallbackReport,
      source: "deterministic-fallback",
      fallbackReason:
        error instanceof InvalidReportResponseError
          ? "invalid-response"
          : "provider-error",
    };
    return NextResponse.json(response);
  }
}
