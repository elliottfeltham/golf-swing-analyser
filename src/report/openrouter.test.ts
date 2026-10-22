import { describe, expect, it, vi } from "vitest";

import {
  InvalidReportResponseError,
  requestOpenRouterReport,
  validateGrounding,
} from "./openrouter";
import type { GeneratedReport } from "./schema";
import { TEMPO_CANDIDATE } from "./test-fixtures";

const validGeneratedReport: GeneratedReport = {
  summary: "The clearest tracked movement is swing timing.",
  insights: [
    {
      candidateId: TEMPO_CANDIDATE.id,
      title: "Swing timing",
      explanation: "The marked phases show a longer backswing than downswing.",
      whyItMayMatter:
        "This can provide a repeatable baseline for comparing your own swings.",
      reviewAction:
        "Compare the address, top, and impact markers on the timeline.",
    },
  ],
};

describe("OpenRouter report grounding", () => {
  it("returns validated prose with server-owned limitations", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        choices: [
          { message: { content: JSON.stringify(validGeneratedReport) } },
        ],
      }),
    );

    const report = await requestOpenRouterReport(
      [TEMPO_CANDIDATE],
      "secret",
      fetcher,
    );

    expect(report.insights).toEqual(validGeneratedReport.insights);
    expect(report.limitations.join(" ")).toMatch(/single-camera/i);
    const request = JSON.parse(
      String((fetcher.mock.calls[0]?.[1] as RequestInit).body),
    );
    expect(request.model).toBe("openrouter/free");
    expect(request.messages[1].content).toContain(TEMPO_CANDIDATE.id);
    expect(request.messages[1].content).not.toContain("landmarks");
  });

  it.each([
    [
      "an unknown candidate",
      {
        ...validGeneratedReport,
        insights: [
          { ...validGeneratedReport.insights[0]!, candidateId: "invented" },
        ],
      },
    ],
    [
      "a repeated candidate",
      {
        ...validGeneratedReport,
        insights: [
          ...validGeneratedReport.insights,
          validGeneratedReport.insights[0]!,
        ],
      },
    ],
    [
      "a numeric claim",
      { ...validGeneratedReport, summary: "Your ratio is 3 to 1." },
    ],
    [
      "an unsupported measurement",
      { ...validGeneratedReport, summary: "Your clubhead speed looks fast." },
    ],
    [
      "a diagnosis",
      { ...validGeneratedReport, summary: "This is a swing fault." },
    ],
    [
      "markup",
      { ...validGeneratedReport, summary: "Read [this](https://example.com)." },
    ],
    [
      "prescriptive instruction",
      { ...validGeneratedReport, summary: "You should change your motion." },
    ],
  ])("rejects %s", (_label, report) => {
    expect(() =>
      validateGrounding(report as GeneratedReport, [TEMPO_CANDIDATE]),
    ).toThrow(InvalidReportResponseError);
  });

  it("rejects provider failures and malformed output", async () => {
    const failed = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("", { status: 429 }));
    await expect(
      requestOpenRouterReport([TEMPO_CANDIDATE], "secret", failed),
    ).rejects.toThrow("HTTP 429");

    const malformed = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ choices: [{ message: { content: "not json" } }] }),
      );
    await expect(
      requestOpenRouterReport([TEMPO_CANDIDATE], "secret", malformed),
    ).rejects.toBeInstanceOf(InvalidReportResponseError);
  });

  it("surfaces a provider timeout for the route to fall back", async () => {
    const timedOut = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException("Timed out", "TimeoutError"));

    await expect(
      requestOpenRouterReport([TEMPO_CANDIDATE], "secret", timedOut),
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });
});
