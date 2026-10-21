import { expect, test } from "@playwright/test";

test("presents the product purpose and privacy promise", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "See the movement behind every frame.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Your video stays in this browser. No footage is uploaded."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Analyse a face-on swing." }),
  ).toBeVisible();
  await expect(page.getByText("No video selected")).toBeVisible();
});

test("explains how to recover from an unsupported upload", async ({ page }) => {
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "swing.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("not-a-video"),
  });

  await expect(
    page.getByRole("heading", { name: "Analysis could not complete." }),
  ).toBeVisible();
  await expect(
    page.getByText("Choose an MP4, MOV, or WebM video"),
  ).toBeVisible();
  await expect(
    page.getByText("Choose another supported video to continue."),
  ).toBeVisible();
});
