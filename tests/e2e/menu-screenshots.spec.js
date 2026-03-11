import { expect, test } from "@playwright/test";

test("menu page screenshots", async ({ page }, testInfo) => {
  const pages = [
    { name: "tickets", url: "/csvtickets" },
    { name: "kba-drafter", tab: "tab-kba-drafter" },
    { name: "usecase-demo", tab: "tab-usecase-demo" },
    { name: "ops-demo", tab: "tab-usecase-demo-ops" },
    { name: "sla-breach-risk", tab: "tab-usecase-demo-sla-breach" },
    { name: "kitchen-sink", tab: "tab-kitchensink" },
    { name: "fields", tab: "tab-fields" },
    { name: "agent-fabric", tab: "tab-workbench" },
    { name: "agent", tab: "tab-agent" },
    { name: "activity", tab: "tab-activity" },
    { name: "workflow", tab: "tab-workflow" },
    { name: "settings", tab: "tab-settings" },
  ];

  await page.goto(pages[0].url);
  await page.screenshot({
    path: testInfo.outputPath(`menu-${pages[0].name}.png`),
    fullPage: true,
  });

  for (const entry of pages.slice(1)) {
    await page.getByTestId(entry.tab).click();
    await expect(page.getByTestId(entry.tab)).toHaveAttribute("aria-selected", "true");
    await page.waitForTimeout(500); // let canvas / SSE settle
    await page.screenshot({
      path: testInfo.outputPath(`menu-${entry.name}.png`),
      fullPage: true,
    });
  }
});
