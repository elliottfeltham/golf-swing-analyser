import { expect, test, type Page } from "@playwright/test";

const reportResponse = {
  report: {
    schemaVersion: 1,
    summary: "The measured swing is ready for evidence-led review.",
    insights: [
      {
        candidateId: "tempo-address-top-impact",
        title: "Review the marked timing",
        explanation: "The marked phases provide a repeatable timing record.",
        whyItMayMatter:
          "This may help when comparing this motion with another recording.",
        reviewAction: "Review address, top, and impact in the video.",
      },
    ],
    limitations: [
      "Single-camera body pose cannot measure clubhead speed or ball flight.",
    ],
  },
  candidates: [
    {
      id: "tempo-address-top-impact",
      category: "tempo",
      phaseIds: ["address", "top", "impact"],
      metricIds: ["backswingDuration", "downswingDuration", "tempoRatio"],
      importance: 100,
      confidence: "high",
      observation: "The three marked phases define the measured timing.",
      approvedContext: "Timing can be compared between the golfer's swings.",
      evidence: [{ metricId: "tempoRatio", value: 2.5, unit: "ratio" }],
    },
  ],
  source: "openrouter",
  allowance: {
    limit: 5,
    remaining: 4,
    resetAt: "2026-10-28T00:00:00.000Z",
    cacheHit: false,
  },
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/reports", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          aiAvailable: true,
          quotaAvailable: true,
          limit: 5,
          remaining: 5,
          resetAt: "2026-10-28T00:00:00.000Z",
        }),
      });
      return;
    }

    const input = route.request().postDataJSON() as Record<string, unknown>;
    expect(Object.keys(input).sort()).toEqual(
      [
        "handedness",
        "phaseHandPath",
        "phases",
        "quality",
        "schemaVersion",
        "timing",
        "view",
      ].sort(),
    );
    const serialized = JSON.stringify(input).toLowerCase();
    expect(serialized).not.toContain("landmark");
    expect(serialized).not.toContain("filename");
    expect(serialized).not.toContain("blob:");
    expect(serialized).not.toContain("video/");

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(reportResponse),
    });
  });
});

test("completes the evidence-linked review with keyboard controls", async ({
  page,
}) => {
  await openMeasuredReview(page);

  const consent = page.getByRole("checkbox", { name: /I agree to send/i });
  await consent.focus();
  await page.keyboard.press("Space");
  await page
    .getByRole("button", { name: "Generate written review" })
    .press("Enter");

  await expect(page.getByText("AI-assisted review")).toBeVisible();
  await page
    .getByRole("button", {
      name: "Review address, top, and impact in the video.",
    })
    .click();
  await expect(page.locator(".media-column")).toBeFocused();

  await page.getByRole("button", { name: "Useful", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Useful", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(() => localStorage.getItem("gsa-report-feedback")),
  ).toContain("useful");
});

test("keeps the mobile review within the viewport", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"));
  await openMeasuredReview(page);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  const controls = page.locator(
    ".playback-controls button, .phase-marker-panel button, .report-generate",
  );
  for (let index = 0; index < (await controls.count()); index += 1) {
    const box = await controls.nth(index).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

async function openMeasuredReview(page: Page) {
  await page.goto("/e2e-fixture");
  await expect(
    page.getByRole("heading", { name: "Review the movement." }),
  ).toBeVisible();

  const phaseButtons = page.locator(".phase-marker-panel li button");
  const slider = page.getByRole("slider", { name: "Analysed frame" });
  await phaseButtons.nth(0).click();
  await slider.fill("5");
  await phaseButtons.nth(1).click();
  await slider.fill("7");
  await phaseButtons.nth(2).click();
  await expect(
    page.getByRole("heading", { name: "Written swing review" }),
  ).toBeVisible();
}
