import { z } from "zod";

import { REPORT_LIMITATIONS } from "./deterministic-report";
import {
  GeneratedReportSchema,
  type GeneratedReport,
  type ObservationCandidate,
  type SwingReport,
} from "./schema";

const OpenRouterResponseSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string() }) }))
    .min(1),
});

const SYSTEM_PROMPT = `You explain trusted golf-swing measurements in plain language.
Write one insight for every supplied candidate and preserve each candidateId exactly.
Use only the candidate observation and approvedContext. Never add or repeat numbers; the application renders numeric evidence separately.
Never diagnose a fault or call movement good, bad, correct, incorrect, ideal, or optimal.
Do not mention clubhead speed, ball flight, club path, impact quality, injury, medical claims, drills, or swing-change instructions.
The reviewAction may only direct the golfer to review or compare the supplied phases, video, overlay, chart, or measurement.
Return plain text fields and only JSON matching the requested schema.`;

const PROHIBITED_CLAIMS = [
  /club\s*head/i,
  /club\s*path/i,
  /ball\s*(flight|speed)/i,
  /impact quality/i,
  /injur|medical|diagnos/i,
  /\b(good|bad|correct|incorrect|ideal|optimal|fault|flaw)\b/i,
  /\b(drill|fix|change your|you should|you must|try to)\b/i,
];
const MARKUP_OR_LINK = /https?:\/\/|<[^>]*>|\[[^\]]*\]\([^)]*\)|[`*_#]/i;

type Fetcher = typeof fetch;

export class InvalidReportResponseError extends Error {}

export async function requestOpenRouterReport(
  candidates: ObservationCandidate[],
  apiKey: string,
  fetcher: Fetcher = fetch,
): Promise<SwingReport> {
  if (candidates.length === 0) {
    throw new InvalidReportResponseError(
      "No grounded candidates were available.",
    );
  }

  const response = await fetcher(
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
            content: `Explain every candidate in this trusted catalogue without adding facts:\n${JSON.stringify(candidates)}`,
          },
        ],
        temperature: 0.2,
        max_completion_tokens: 900,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "grounded_swing_report",
            strict: true,
            schema: generatedReportJsonSchema(candidates.length),
          },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok) {
    throw new Error(`OpenRouter returned HTTP ${response.status}.`);
  }

  let providerPayload: unknown;
  try {
    providerPayload = await response.json();
  } catch {
    throw new InvalidReportResponseError(
      "OpenRouter returned an invalid response body.",
    );
  }
  const parsedProvider = OpenRouterResponseSchema.safeParse(providerPayload);
  if (!parsedProvider.success) {
    throw new InvalidReportResponseError(
      "OpenRouter returned an invalid response envelope.",
    );
  }
  const providerResponse = parsedProvider.data;
  const content = providerResponse.choices[0]?.message.content;
  if (!content) {
    throw new InvalidReportResponseError("OpenRouter returned no report.");
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(content);
  } catch {
    throw new InvalidReportResponseError("OpenRouter returned invalid JSON.");
  }

  const parsed = GeneratedReportSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new InvalidReportResponseError(
      "OpenRouter returned an invalid report shape.",
    );
  }
  validateGrounding(parsed.data, candidates);
  return {
    schemaVersion: 1,
    ...parsed.data,
    limitations: [...REPORT_LIMITATIONS],
  };
}

export function validateGrounding(
  report: GeneratedReport,
  candidates: ObservationCandidate[],
) {
  const candidateIds = new Set(candidates.map(({ id }) => id));
  const usedIds = new Set<string>();
  if (report.insights.length !== candidates.length) {
    throw new InvalidReportResponseError(
      "Report did not explain every selected candidate.",
    );
  }

  for (const insight of report.insights) {
    if (
      !candidateIds.has(insight.candidateId) ||
      usedIds.has(insight.candidateId)
    ) {
      throw new InvalidReportResponseError(
        "Report referenced invalid evidence.",
      );
    }
    validateGeneratedText([
      insight.title,
      insight.explanation,
      insight.whyItMayMatter,
      insight.reviewAction,
    ]);
    usedIds.add(insight.candidateId);
  }
  validateGeneratedText([report.summary]);
}

function validateGeneratedText(fields: string[]) {
  const prose = fields.join(" ");
  if (/\d/.test(prose)) {
    throw new InvalidReportResponseError(
      "Report prose contained an untrusted numeric claim.",
    );
  }
  if (MARKUP_OR_LINK.test(prose)) {
    throw new InvalidReportResponseError(
      "Report prose contained markup or a link.",
    );
  }
  if (PROHIBITED_CLAIMS.some((pattern) => pattern.test(prose))) {
    throw new InvalidReportResponseError(
      "Report prose contained a prohibited claim.",
    );
  }
}

function generatedReportJsonSchema(insightCount: number) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["summary", "insights"],
    properties: {
      summary: { type: "string", minLength: 1, maxLength: 300 },
      insights: {
        type: "array",
        minItems: insightCount,
        maxItems: insightCount,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "candidateId",
            "title",
            "explanation",
            "whyItMayMatter",
            "reviewAction",
          ],
          properties: {
            candidateId: { type: "string", maxLength: 80 },
            title: { type: "string", minLength: 1, maxLength: 80 },
            explanation: { type: "string", minLength: 1, maxLength: 400 },
            whyItMayMatter: { type: "string", minLength: 1, maxLength: 400 },
            reviewAction: { type: "string", minLength: 1, maxLength: 180 },
          },
        },
      },
    },
  };
}
