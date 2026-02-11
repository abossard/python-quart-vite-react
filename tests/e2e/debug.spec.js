import { expect, test } from "@playwright/test";

test("debug smoke - app shell renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("CSV Ticket Viewer")).toBeVisible();
  await expect(page.getByTestId("tab-csvtickets")).toBeVisible();
});
