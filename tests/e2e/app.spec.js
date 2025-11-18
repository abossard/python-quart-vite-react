/**
 * End-to-End Tests for Quart + React Demo App
 *
 * These tests are designed to be:
 * - Easy to understand and maintain
 * - Close to the UI (testing user interactions)
 * - Light-hearted and fun to read
 */

import { expect, test } from "@playwright/test";

function uniqueTitle(prefix) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix} ${suffix}`;
}

// Helper function to wait for React app to load
async function waitForAppToLoad(page) {
  // Listen for console errors
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`Browser console error: ${msg.text()}`);
    }
  });

  // Wait for the React app to render by checking for the main app header
  await page.waitForSelector("text=Quart + React Demo Application", {
    timeout: 15000,
  });
}

// ============================================================================
// DASHBOARD TESTS - Testing the fun real-time features!
// ============================================================================

test.describe("Dashboard - Time is on our side", () => {
  test("shows the live server time ticking away", async ({ page }) => {
    await page.goto("http://localhost:3001", { waitUntil: "load" });
    await waitForAppToLoad(page);

    // Check that we're on the dashboard
    await expect(page.getByTestId("tab-dashboard")).toHaveAttribute(
      "aria-selected",
      "true"
    );

    // Wait for the live time to appear (SSE magic!)
    const liveTimeElement = page.getByTestId("live-time");
    await expect(liveTimeElement).toBeVisible({ timeout: 10000 });

    // Verify it shows a time-like format (HH:MM:SS)
    const timeText = await liveTimeElement.textContent();
    expect(timeText).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  test("displays server date from API", async ({ page }) => {
    await page.goto("http://localhost:3001", { waitUntil: "load" });
    await waitForAppToLoad(page);

    // The server knows what day it is!
    const dateElement = page.getByTestId("server-date");
    await expect(dateElement).toBeVisible();

    // Should look like a date (YYYY-MM-DD)
    const dateText = await dateElement.textContent();
    expect(dateText).toMatch(/\d{4}-\d{2}-\d{2}/);

    // And it should have a time too
    const timeElement = page.getByTestId("server-time");
    await expect(timeElement).toBeVisible();
  });
});

// ============================================================================
// TASK MANAGEMENT TESTS - Let's get things done!
// ============================================================================

test.describe("Task Management - Getting stuff done", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3001", { waitUntil: "load" });
    await waitForAppToLoad(page);
    // Navigate to Tasks tab
    await page.getByTestId("tab-tasks").click();
    await expect(page.getByTestId("tab-tasks")).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("shows the task list with sample tasks", async ({ page }) => {
    // We should see some sample tasks loaded
    await expect(page.getByText("Task Management")).toBeVisible();

    // The filter buttons should be there
    await expect(page.getByTestId("filter-all")).toBeVisible();
    await expect(page.getByTestId("filter-pending")).toBeVisible();
    await expect(page.getByTestId("filter-completed")).toBeVisible();
  });

  test("creates a new task like a boss", async ({ page }) => {
    // Click the "New Task" button
    await page.getByTestId("create-task-button").click();

    // Fill in the task details
    const taskTitle = `Test task created at ${new Date().toLocaleTimeString()}`;
    await page.getByTestId("task-title-input").fill(taskTitle);
    await page
      .getByTestId("task-description-input")
      .fill("This task was created by our awesome E2E test!");

    // Save it!
    await page.getByTestId("save-button").click();

    // Wait for dialog to close and task to appear
    await expect(page.getByTestId("task-title-input")).not.toBeVisible();

    // Verify our new task is in the list
    await expect(page.getByText(taskTitle)).toBeVisible();
  });

  test("completes a task with satisfaction", async ({ page }) => {
    // First, create a task to complete
    await page.getByTestId("create-task-button").click();
    const taskTitle = uniqueTitle("Task to complete");
    await page.getByTestId("task-title-input").fill(taskTitle);
    await page.getByTestId("save-button").click();

    // Wait for the task to appear
    await expect(page.getByText(taskTitle)).toBeVisible();

    // Find the task row and get its ID from the title
    const taskRow = page.locator('[data-testid^="task-title-"]', {
      hasText: taskTitle,
    });
    const taskId = (await taskRow.getAttribute("data-testid")).replace(
      "task-title-",
      ""
    );

    // Click the complete button
    await page.getByTestId(`toggle-task-${taskId}`).click();

    // The task should now show as completed
    // We can verify by filtering to completed tasks
    await page.getByTestId("filter-completed").click();
    await expect(page.getByText(taskTitle)).toBeVisible();
  });

  test("edits a task like a pro", async ({ page }) => {
    // Create a task first
    await page.getByTestId("create-task-button").click();
    const originalTitle = uniqueTitle("Original task title");
    await page.getByTestId("task-title-input").fill(originalTitle);
    await page.getByTestId("save-button").click();

    // Wait for task to appear
    await expect(page.getByText(originalTitle)).toBeVisible();

    // Find and edit the task
    const taskRow = page.locator('[data-testid^="task-title-"]', {
      hasText: originalTitle,
    });
    const taskId = (await taskRow.getAttribute("data-testid")).replace(
      "task-title-",
      ""
    );

    // Open the menu and click edit
    await page.getByTestId(`task-menu-${taskId}`).click();
    await page.getByTestId(`edit-task-${taskId}`).click();

    // Update the title
    const updatedTitle = uniqueTitle("Updated task title");
    const titleInput = page.getByTestId("task-title-input");
    await titleInput.clear();
    await titleInput.fill(updatedTitle);
    await page.getByTestId("save-button").click();

    // Verify the update
    await expect(page.getByText(updatedTitle)).toBeVisible();
    await expect(page.getByText(originalTitle)).not.toBeVisible();
  });

  test("deletes a task when no longer needed", async ({ page }) => {
    // Create a task to delete
    await page.getByTestId("create-task-button").click();
    const taskTitle = uniqueTitle("Task to be deleted");
    await page.getByTestId("task-title-input").fill(taskTitle);
    await page.getByTestId("save-button").click();

    // Wait for task to appear
    await expect(page.getByText(taskTitle)).toBeVisible();

    // Find the task and delete it
    const taskRow = page.locator('[data-testid^="task-title-"]', {
      hasText: taskTitle,
    });
    const taskId = (await taskRow.getAttribute("data-testid")).replace(
      "task-title-",
      ""
    );

    // Open menu and delete
    await page.getByTestId(`task-menu-${taskId}`).click();
    await page.getByTestId(`delete-task-${taskId}`).click();

    // Task should be gone
    await expect(page.getByText(taskTitle)).not.toBeVisible();
  });

  test("filters tasks by status like a filtering ninja", async ({ page }) => {
    // Create a completed task
    await page.getByTestId("create-task-button").click();
    const completedTitle = uniqueTitle("Completed task");
    await page.getByTestId("task-title-input").fill(completedTitle);
    await page.getByTestId("save-button").click();

    const completedTaskRow = page.locator('[data-testid^="task-title-"]', {
      hasText: completedTitle,
    });
    const completedId = (
      await completedTaskRow.getAttribute("data-testid")
    ).replace("task-title-", "");
    await page.getByTestId(`toggle-task-${completedId}`).click();

    // Create a pending task
    await page.getByTestId("create-task-button").click();
    const pendingTitle = uniqueTitle("Pending task");
    await page.getByTestId("task-title-input").fill(pendingTitle);
    await page.getByTestId("save-button").click();

    // Filter to show only pending
    await page.getByTestId("filter-pending").click();
    await expect(page.getByText(pendingTitle)).toBeVisible();
    await expect(page.getByText(completedTitle)).not.toBeVisible();

    // Filter to show only completed
    await page.getByTestId("filter-completed").click();
    await expect(page.getByText(completedTitle)).toBeVisible();
    await expect(page.getByText(pendingTitle)).not.toBeVisible();

    // Show all again
    await page.getByTestId("filter-all").click();
    await expect(page.getByText(completedTitle)).toBeVisible();
    await expect(page.getByText(pendingTitle)).toBeVisible();
  });
});

// ============================================================================
// NAVIGATION TESTS - Moving around with style
// ============================================================================

test.describe("Navigation - Exploring the app", () => {
  test("navigates between tabs smoothly", async ({ page }) => {
    await page.goto("http://localhost:3001", { waitUntil: "load" });
    await waitForAppToLoad(page);

    // Start on Dashboard
    await expect(page.getByTestId("tab-dashboard")).toHaveAttribute(
      "aria-selected",
      "true"
    );

    // Go to Tasks
    await page.getByTestId("tab-tasks").click();
    await expect(page.getByTestId("tab-tasks")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByText("Task Management")).toBeVisible();

    // Go to About
    await page.getByTestId("tab-about").click();
    await expect(page.getByTestId("tab-about")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByText("About This Project")).toBeVisible();

    // Back to Dashboard
    await page.getByTestId("tab-dashboard").click();
    await expect(page.getByTestId("tab-dashboard")).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("shows the awesome project title", async ({ page }) => {
    await page.goto("http://localhost:3001", { waitUntil: "load" });
    await waitForAppToLoad(page);

    // Our glorious header should be visible
    await expect(
      page.getByText("Quart + React Demo Application")
    ).toBeVisible();
  });
});

// ============================================================================
// ABOUT PAGE TESTS - Learning is fun!
// ============================================================================

test.describe("About Page - All the good info", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3001", { waitUntil: "load" });
    await waitForAppToLoad(page);
    await page.getByTestId("tab-about").click();
  });

  test("displays project information", async ({ page }) => {
    await expect(page.getByText("About This Project")).toBeVisible();
    await expect(
      page.getByText(/This is a modern full-stack web application/)
    ).toBeVisible();
  });

  test("shows all the cool technologies used", async ({ page }) => {
    // Click to expand technologies accordion
    await page.getByText("Technologies Used").click();

    // Verify some key technologies are mentioned
    await expect(page.getByText(/Python Quart/).first()).toBeVisible();
    await expect(page.getByText(/React 18/).first()).toBeVisible();
    await expect(page.getByText(/FluentUI/).first()).toBeVisible();
  });
});
