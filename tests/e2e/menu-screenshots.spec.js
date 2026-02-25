import { test } from "@playwright/test";

test("menu page screenshots", async ({ page }, testInfo) => {
  const pages = [
    { name: "tickets", url: "/csvtickets" },
    { name: "usecase-demo", tab: "tab-usecase-demo" },
    { name: "ops-demo", tab: "tab-usecase-demo-ops" },
    { name: "sla-breach-risk", tab: "tab-usecase-demo-sla-breach" },
    { name: "kitchen-sink", tab: "tab-kitchensink" },
    { name: "fields", tab: "tab-fields" },
    { name: "agent-fabric", tab: "tab-workbench" },
    { name: "agent", tab: "tab-agent" },
  ];

  await page.goto(pages[0].url);
  await page.screenshot({
    path: testInfo.outputPath(`menu-${pages[0].name}.png`),
    fullPage: true,
  });

  for (const entry of pages.slice(1)) {
    await page.getByTestId(entry.tab).click();
    await page.screenshot({
      path: testInfo.outputPath(`menu-${entry.name}.png`),
      fullPage: true,
    });
  }
});
