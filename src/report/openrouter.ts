import { z } from "zod";

import {
  type AnalysisReportInput,
  type SwingReport,
  SwingReportSchema,
} from "./schema";

const OpenRouterResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string() }),
      }),
    )
    .min(1),
});

const SYSTEM_PROMPT = `You explain measured golf-swing movement in plain language.
Use only the supplied candidates. Never diagnose a fault or declare movement good, bad, correct, or incorrect.
Do not add measurements, numbers, clubhead speed, ball flight, medical claims, drills, or swing-change instructions.
Use cautious language and return only JSON matching the requested schema.`;

export class InvalidReportResponseError extends Error {}

export async function requestOpenRouterReport(
  input: AnalysisReportInput,
  apiKey: string,
): Promise<SwingReport> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(process.env.OPENROUTER_SITE_URL
          ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL }
          : {}),
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "Golf Swing Analyser",
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Select up to three useful observations from this trusted data:\n${JSON.stringify(input.candidates)}`,
          },
        ],
        temperature: 0.2,
        max_completion_tokens: 700,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "swing_report",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["summary", "insights", "disclaimer"],
              properties: {
                summary: { type: "string", maxLength: 300 },
                insights: {
                  type: "array",
                  minItems: 1,
                  maxItems: 4,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["candidateId", "heading", "explanation"],
                    properties: {
                      candidateId: { type: "string", maxLength: 64 },
                      heading: { type: "string", maxLength: 80 },
                      explanation: { type: "string", maxLength: 400 },
                    },
                  },
                },
                disclaimer: { type: "string", maxLength: 240 },
              },
            },
          },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok) {
    throw new Error(`OpenRouter returned HTTP ${response.status}.`);
  }

  const providerResponse = OpenRouterResponseSchema.parse(
    await response.json(),
  );
  const content = providerResponse.choices[0]?.message.content;
  if (!content)
    throw new InvalidReportResponseError("OpenRouter returned no report.");

  let decoded: unknown;
  try {
    decoded = JSON.parse(content);
  } catch {
    throw new InvalidReportResponseError("OpenRouter returned invalid JSON.");
  }

  const report = SwingReportSchema.parse(decoded);
  validateGrounding(report, input);
  return report;
}

function validateGrounding(report: SwingReport, input: AnalysisReportInput) {
  const candidateIds = new Set(
    input.candidates.map((candidate) => candidate.id),
  );
  const usedIds = new Set<string>();

  for (const insight of report.insights) {
    if (
      !candidateIds.has(insight.candidateId) ||
      usedIds.has(insight.candidateId)
    ) {
      throw new InvalidReportResponseError(
        "Report referenced invalid evidence.",
      );
    }
    if (/\d/.test(`${insight.heading} ${insight.explanation}`)) {
      throw new InvalidReportResponseError(
        "Report prose contained a numeric claim.",
      );
    }
    usedIds.add(insight.candidateId);
  }
}
