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
});
