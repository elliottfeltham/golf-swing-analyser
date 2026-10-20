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
