import path from "node:path";

import { expect, test } from "@playwright/test";

test.skip(
  process.env.RUN_REAL_POSE_FIXTURE !== "1",
  "Run manually with the local, ignored golf-video fixture.",
);

test("builds a production pose sequence from the golf fixture", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto("/");

  await page
    .locator('input[type="file"]')
    .setInputFiles(
      path.resolve("test-fixtures/videos/pexels-golf-swing-6573612.mp4"),
    );

  await expect(
    page.getByRole("heading", { name: "Pose sequence ready." }),
  ).toBeVisible({ timeout: 220_000 });
  await expect(page.getByText("Pose frames", { exact: true })).toBeVisible();
  await expect(page.getByText("Availability", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Review the movement." }),
  ).toBeVisible();
  await expect(page.locator("canvas.pose-overlay")).toBeVisible();
  await page
    .locator(".phase-marker-panel li")
    .first()
    .getByRole("button")
    .click();
  await expect(
    page.getByText("Lead elbow", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByLabel("Lead elbow chart")).toBeVisible();

  const frameRange = page.getByRole("slider", { name: "Analysed frame" });
  const maximum = Number(await frameRange.getAttribute("max"));
  await frameRange.fill(String(Math.max(1, Math.floor(maximum / 2))));
  await page
    .locator(".phase-marker-panel li")
    .nth(1)
    .getByRole("button")
    .click();
  await frameRange.fill(String(Math.max(2, Math.floor((maximum * 3) / 4))));
  await page
    .locator(".phase-marker-panel li")
    .nth(2)
    .getByRole("button")
    .click();

  await expect(
    page.getByRole("heading", { name: "Written swing review" }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: /I agree to send/i }).check();
  await page
    .getByRole("button", { name: /written review/i })
    .last()
    .click();
  await expect(page.getByText("Evidence-led local review")).toBeVisible();
  await expect(page.getByRole("article").first()).toBeVisible();
});
