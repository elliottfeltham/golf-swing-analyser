import { expect, test } from "@playwright/test";

test("presents the product purpose and privacy promise", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Understand the movement behind your swing.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Video processing stays on your device."),
  ).toBeVisible();
});
