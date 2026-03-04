import { expect, test } from "@playwright/test";

const APP_URL = process.env.E2E_APP_URL || "http://localhost:3001";

const API_URL = process.env.E2E_API_URL || "http://localhost:5001";
const MOCK_DRAFT = {
  id: "d1234567-aaaa-bbbb-cccc-111111111111",
  ticket_id: "t1234567-aaaa-bbbb-cccc-222222222222",
  incident_id: "INC000016349815",
  title: "VPN-Verbindungsprobleme unter Windows 11 beheben",
  symptoms: ["VPN-Client zeigt Fehler 'Connection timed out'", "Keine Verbindung zum Firmennetz möglich"],
  cause: "Veralteter VPN-Client nach Windows-Update",
  resolution_steps: ["VPN-Client deinstallieren", "Neueste Version herunterladen", "Neu installieren und konfigurieren"],
  validation_checks: ["Verbindung zum Firmennetz testen", "Interne Webseiten aufrufen"],
  warnings: ["VPN-Profil muss nach Neuinstallation neu importiert werden"],
  confidence_notes: "Lösung basiert auf häufig gemeldeten Fällen",
  problem_description: "",
  additional_notes: "",
  tags: ["vpn", "windows", "netzwerk"],
  related_tickets: [],
  search_questions: ["Wie behebe ich VPN-Probleme?", "VPN verbindet sich nicht nach Windows Update"],
  generation_warnings: [],
  guidelines_used: ["VPN", "GENERAL"],
  status: "draft",
  created_at: "2026-03-04T10:00:00",
  updated_at: "2026-03-04T10:00:00",
  created_by: "test-user",
  reviewed_by: null,
  published_at: null,
  published_url: null,
  published_id: null,
  llm_model: "gpt-4o-mini",
  llm_generation_time_ms: 3200,
  is_auto_generated: false,
};

const MOCK_TICKET = {
  incident_id: "INC000016349815",
  id: "t1234567-aaaa-bbbb-cccc-222222222222",
  summary: "VPN Failure on Remote Access",
  status: "resolved",
  priority: "high",
  assignee: "John Doe",
  assigned_group: "Network Team",
  requester_name: "Alex Doe",
  city: "Bern",
  service: "Network",
  description: "VPN clients cannot connect after Windows update.",
  notes: "Issue started after KB5034441 update.",
  resolution: "Reinstalled VPN client.",
};

/**
 * Navigate to the KBA Drafter page, waiting for the app shell to load first.
 */
async function visitKBADrafter(page) {
  await page.goto(`${APP_URL}/kba-drafter`, { waitUntil: "load" });
  await expect(page.getByRole("heading", { name: "KBA Drafter" })).toBeVisible({ timeout: 10000 });
}

/**
 * Set up common API mocks for KBA drafter tests.
 * Mocks: health, list drafts, list guidelines, auto-gen settings.
 */
async function setupBaseMocks(page) {
  // Health check - LLM available
  await page.route("**/api/kba/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        llm_available: true,
        llm_model: "gpt-4o-mini",
      }),
    });
  });

  // List drafts - empty initially (only intercept GET)
  await page.route("**/api/kba/drafts?*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], total: 0, limit: 10, offset: 0 }),
      });
    } else {
      await route.fallback();
    }
  });

  await page.route("**/api/kba/drafts", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], total: 0, limit: 10, offset: 0 }),
      });
    } else {
      await route.fallback();
    }
  });

  // Guidelines
  await page.route("**/api/kba/guidelines", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        categories: ["GENERAL", "VPN", "NETWORK", "PASSWORD_RESET"],
      }),
    });
  });

  // Auto-gen settings
  await page.route("**/api/kba/auto-gen/settings", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        enabled: false,
        schedule_time: "12:00",
        max_tickets_per_run: 5,
        priority_filter: [],
        status_filter: [],
      }),
    });
  });
}

// ============================================================================
// PAGE LOAD & NAVIGATION
// ============================================================================

test.describe("KBA Drafter - Page Load", () => {
  test("loads the KBA Drafter page and shows header", async ({ page }) => {
    await setupBaseMocks(page);
    await visitKBADrafter(page);

    await expect(page.getByRole("heading", { name: "KBA Drafter" })).toBeVisible();
    await expect(
      page.getByText("Erstellen Sie Knowledge Base Articles aus Support-Tickets mit KI-Unterstützung")
    ).toBeVisible();
  });

  test("navigates to KBA Drafter via tab", async ({ page }) => {
    await setupBaseMocks(page);
    await page.goto(APP_URL, { waitUntil: "load" });
    await expect(page.getByText("CSV Ticket Viewer")).toBeVisible();

    await page.getByTestId("tab-kba-drafter").click();
    await expect(page.getByTestId("tab-kba-drafter")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByRole("heading", { name: "KBA Drafter" })).toBeVisible();
  });

  test("shows input section with ticket ID field and generate button", async ({ page }) => {
    await setupBaseMocks(page);
    await visitKBADrafter(page);

    await expect(page.getByText("Neuen KBA-Entwurf erstellen")).toBeVisible();
    await expect(
      page.getByPlaceholder("INC000016349815 oder 550e8400-e29b-41d4-a716-446655440000")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Entwurf erstellen" })).toBeVisible();
  });

  test("generate button is disabled when input is empty", async ({ page }) => {
    await setupBaseMocks(page);
    await visitKBADrafter(page);

    const generateButton = page.getByRole("button", { name: "Entwurf erstellen" });
    await expect(generateButton).toBeDisabled();
  });
});

// ============================================================================
// LLM HEALTH STATUS
// ============================================================================

test.describe("KBA Drafter - LLM Health", () => {
  test("shows warning when LLM is unavailable", async ({ page }) => {
    await page.route("**/api/kba/health", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "degraded",
          llm_available: false,
          llm_model: null,
        }),
      });
    });

    // Still need other mocks
    await page.route("**/api/kba/drafts*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [], total: 0, limit: 10, offset: 0 }),
        });
      }
    });

    await page.route("**/api/kba/auto-gen/settings", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ enabled: false, schedule_time: "12:00", max_tickets_per_run: 5 }),
      });
    });

    await visitKBADrafter(page);
    await expect(page.getByText("LLM nicht verfügbar")).toBeVisible();
  });
});

// ============================================================================
// DRAFT GENERATION
// ============================================================================

test.describe("KBA Drafter - Draft Generation", () => {
  test("validates ticket ID format", async ({ page }) => {
    await setupBaseMocks(page);
    await visitKBADrafter(page);

    const input = page.getByPlaceholder("INC000016349815 oder 550e8400-e29b-41d4-a716-446655440000");
    const generateButton = page.getByRole("button", { name: "Entwurf erstellen" });

    // Type invalid input and submit
    await input.fill("invalid-id");
    await generateButton.click();

    await expect(page.getByText("Ungültiges Format")).toBeVisible();
  });

  test("generates a draft from a valid incident ID", async ({ page }) => {
    await setupBaseMocks(page);

    // Mock ticket lookup by incident ID
    await page.route("**/api/csv-tickets/by-incident/INC000016349815*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_TICKET),
      });
    });

    // Mock draft generation
    await page.route("**/api/kba/drafts", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(MOCK_DRAFT),
        });
        return;
      }
      // GET requests for list
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [MOCK_DRAFT], total: 1, limit: 10, offset: 0 }),
      });
    });

    await visitKBADrafter(page);

    const input = page.getByPlaceholder("INC000016349815 oder 550e8400-e29b-41d4-a716-446655440000");
    await input.fill("INC000016349815");

    const generateButton = page.getByRole("button", { name: "Entwurf erstellen" });
    await generateButton.click();

    // Should show the generated draft
    await expect(page.getByText("VPN-Verbindungsprobleme unter Windows 11 beheben")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("KBA-Entwurf", { exact: true })).toBeVisible();
    await expect(page.getByText("INC000016349815")).toBeVisible();
  });

  test("shows error when ticket is not found", async ({ page }) => {
    await setupBaseMocks(page);

    await page.route("**/api/csv-tickets/by-incident/INC999999999999*", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Ticket not found" }),
      });
    });

    await visitKBADrafter(page);

    const input = page.getByPlaceholder("INC000016349815 oder 550e8400-e29b-41d4-a716-446655440000");
    await input.fill("INC999999999999");

    const generateButton = page.getByRole("button", { name: "Entwurf erstellen" });
    await generateButton.click();

    await expect(page.getByText(/Fehler|nicht gefunden|not found/i)).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// DRAFT DISPLAY
// ============================================================================

test.describe("KBA Drafter - Draft Display", () => {
  test("displays all draft sections correctly", async ({ page }) => {
    await setupBaseMocks(page);

    // Mock ticket lookup
    await page.route("**/api/csv-tickets/by-incident/INC000016349815*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_TICKET),
      });
    });

    // Mock draft generation
    await page.route("**/api/kba/drafts", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(MOCK_DRAFT),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [MOCK_DRAFT], total: 1, limit: 10, offset: 0 }),
      });
    });

    await visitKBADrafter(page);

    // Generate a draft
    const input = page.getByPlaceholder("INC000016349815 oder 550e8400-e29b-41d4-a716-446655440000");
    await input.fill("INC000016349815");
    await page.getByRole("button", { name: "Entwurf erstellen" }).click();

    // Title
    await expect(page.getByText("VPN-Verbindungsprobleme unter Windows 11 beheben")).toBeVisible({ timeout: 10000 });

    // Symptoms
    await expect(page.getByText("VPN-Client zeigt Fehler 'Connection timed out'")).toBeVisible();
    await expect(page.getByText("Keine Verbindung zum Firmennetz möglich")).toBeVisible();

    // Cause
    await expect(page.getByText("Veralteter VPN-Client nach Windows-Update")).toBeVisible();

    // Resolution steps
    await expect(page.getByText("VPN-Client deinstallieren")).toBeVisible();
    await expect(page.getByText("Neueste Version herunterladen")).toBeVisible();

    // Tags
    await expect(page.getByText("vpn", { exact: true })).toBeVisible();
    await expect(page.getByText("windows", { exact: true })).toBeVisible();
    await expect(page.getByText("netzwerk", { exact: true })).toBeVisible();

    // Search questions
    await expect(page.getByText("Wie behebe ich VPN-Probleme?")).toBeVisible();
  });
});

// ============================================================================
// DRAFT LIST
// ============================================================================

test.describe("KBA Drafter - Draft List", () => {
  test("shows list of existing drafts", async ({ page }) => {
    const draftsList = [
      { ...MOCK_DRAFT, id: "d1", title: "VPN-Probleme lösen", incident_id: "INC001", status: "draft" },
      { ...MOCK_DRAFT, id: "d2", title: "Outlook nicht erreichbar", incident_id: "INC002", status: "reviewed" },
    ];

    await page.route("**/api/kba/health", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok", llm_available: true, llm_model: "gpt-4o-mini" }),
      });
    });

    await page.route("**/api/kba/drafts*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: draftsList, total: 2, limit: 10, offset: 0 }),
        });
      }
    });

    await page.route("**/api/kba/auto-gen/settings", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ enabled: false, schedule_time: "12:00", max_tickets_per_run: 5 }),
      });
    });

    await visitKBADrafter(page);

    // Both drafts should be visible in the list
    await expect(page.getByText("VPN-Probleme lösen")).toBeVisible();
    await expect(page.getByText("Outlook nicht erreichbar")).toBeVisible();
    await expect(page.getByText("INC001")).toBeVisible();
    await expect(page.getByText("INC002")).toBeVisible();
  });

  test("loads a draft when clicking on it in the list", async ({ page }) => {
    const draftInList = {
      ...MOCK_DRAFT,
      id: "d1234567-aaaa-bbbb-cccc-111111111111",
      title: "VPN-Probleme lösen",
    };

    await page.route("**/api/kba/health", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok", llm_available: true, llm_model: "gpt-4o-mini" }),
      });
    });

    await page.route("**/api/kba/drafts*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [draftInList], total: 1, limit: 10, offset: 0 }),
        });
      }
    });

    await page.route(`**/api/kba/drafts/${draftInList.id}`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(draftInList),
        });
      }
    });

    await page.route("**/api/kba/auto-gen/settings", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ enabled: false, schedule_time: "12:00", max_tickets_per_run: 5 }),
      });
    });

    await visitKBADrafter(page);

    // Click on the draft in the list
    await page.getByText("VPN-Probleme lösen").click();

    // Draft should now be displayed in the editor
    await expect(page.getByText("KBA-Entwurf", { exact: true })).toBeVisible();
  });
});

// ============================================================================
// DRAFT EDITING
// ============================================================================

test.describe("KBA Drafter - Draft Editing", () => {
  async function setupDraftEditMocks(page) {
    await setupBaseMocks(page);

    await page.route("**/api/csv-tickets/by-incident/INC000016349815*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_TICKET),
      });
    });

    await page.route("**/api/kba/drafts", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(MOCK_DRAFT),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [MOCK_DRAFT], total: 1, limit: 10, offset: 0 }),
      });
    });

    await page.route(`**/api/kba/drafts/${MOCK_DRAFT.id}`, async (route) => {
      if (route.request().method() === "PATCH") {
        const body = JSON.parse(route.request().postData() || "{}");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ...MOCK_DRAFT, ...body.updates, updated_at: new Date().toISOString() }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_DRAFT),
      });
    });
  }

  test("enters edit mode and modifies title", async ({ page }) => {
    await setupDraftEditMocks(page);
    await visitKBADrafter(page);

    // Generate a draft first
    const input = page.getByPlaceholder("INC000016349815 oder 550e8400-e29b-41d4-a716-446655440000");
    await input.fill("INC000016349815");
    await page.getByRole("button", { name: "Entwurf erstellen" }).click();
    await expect(page.getByText("VPN-Verbindungsprobleme unter Windows 11 beheben")).toBeVisible({ timeout: 10000 });

    // Click edit button
    await page.getByRole("button", { name: "Bearbeiten" }).click();

    // Title input should now be editable
    const titleInput = page.locator('input').nth(1); // Second input (first is the ticket ID)
    await expect(titleInput).toHaveValue("VPN-Verbindungsprobleme unter Windows 11 beheben");

    // Modify the title (fill clears first)
    await titleInput.fill("Updated VPN Title");

    // Should show unsaved indicator
    await expect(page.getByText("Nicht gespeichert")).toBeVisible();

    // Save button should be enabled
    const saveButton = page.getByRole("button", { name: "Speichern" });
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeEnabled();
  });

  test("saves edited draft", async ({ page }) => {
    await setupDraftEditMocks(page);
    await visitKBADrafter(page);

    // Generate
    const input = page.getByPlaceholder("INC000016349815 oder 550e8400-e29b-41d4-a716-446655440000");
    await input.fill("INC000016349815");
    await page.getByRole("button", { name: "Entwurf erstellen" }).click();
    await expect(page.getByText("VPN-Verbindungsprobleme unter Windows 11 beheben")).toBeVisible({ timeout: 10000 });

    // Edit mode
    await page.getByRole("button", { name: "Bearbeiten" }).click();

    // Modify title
    const titleInput = page.locator('input').nth(1);
    await titleInput.fill("Updated VPN Title");

    // Save
    await page.getByRole("button", { name: "Speichern" }).click();

    // After save, success message should appear
    await expect(page.getByText(/gespeichert|Speichern/)).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// DRAFT REVIEW
// ============================================================================

test.describe("KBA Drafter - Draft Review", () => {
  test("marks draft as reviewed", async ({ page }) => {
    await setupBaseMocks(page);

    await page.route("**/api/csv-tickets/by-incident/INC000016349815*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_TICKET),
      });
    });

    const reviewedDraft = { ...MOCK_DRAFT, status: "reviewed", reviewed_by: "test-user" };

    await page.route("**/api/kba/drafts", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(MOCK_DRAFT),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [MOCK_DRAFT], total: 1, limit: 10, offset: 0 }),
      });
    });

    await page.route(`**/api/kba/drafts/${MOCK_DRAFT.id}`, async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(reviewedDraft),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_DRAFT),
      });
    });

    await visitKBADrafter(page);

    // Generate
    const input = page.getByPlaceholder("INC000016349815 oder 550e8400-e29b-41d4-a716-446655440000");
    await input.fill("INC000016349815");
    await page.getByRole("button", { name: "Entwurf erstellen" }).click();
    await expect(page.getByText("VPN-Verbindungsprobleme unter Windows 11 beheben")).toBeVisible({ timeout: 10000 });

    // Click review button
    const reviewButton = page.getByRole("button", { name: "Als geprüft markieren" });
    await expect(reviewButton).toBeVisible();
    await reviewButton.click();

    // Should show reviewed status
    await expect(page.getByText("reviewed")).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// DUPLICATE DRAFT HANDLING
// ============================================================================

test.describe("KBA Drafter - Duplicate Handling", () => {
  test("shows duplicate dialog when draft already exists for ticket", async ({ page }) => {
    await setupBaseMocks(page);

    await page.route("**/api/csv-tickets/by-incident/INC000016349815*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_TICKET),
      });
    });

    // Generate returns a 409 for duplicate
    await page.route("**/api/kba/drafts", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            error: "A draft already exists for this ticket",
            type: "duplicate_kba_draft",
            existing_drafts: [
              { id: MOCK_DRAFT.id, title: MOCK_DRAFT.title, status: "draft", created_at: MOCK_DRAFT.created_at },
            ],
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], total: 0, limit: 10, offset: 0 }),
      });
    });

    await visitKBADrafter(page);

    const input = page.getByPlaceholder("INC000016349815 oder 550e8400-e29b-41d4-a716-446655440000");
    await input.fill("INC000016349815");
    await page.getByRole("button", { name: "Entwurf erstellen" }).click();

    // Should show the duplicate dialog
    await expect(page.getByText("KBA-Entwurf bereits vorhanden")).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================================
// BACKEND API INTEGRATION (live, not mocked)
// ============================================================================

test.describe("KBA Drafter - Backend API", () => {
  test("health endpoint returns valid response", async ({ request }) => {
    const response = await request.get(`${API_URL}/api/kba/health`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("llm_available");
  });

  test("drafts list endpoint returns valid response", async ({ request }) => {
    const response = await request.get(`${API_URL}/api/kba/drafts`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("items");
    expect(data).toHaveProperty("total");
    expect(Array.isArray(data.items)).toBe(true);
  });

  test("auto-gen settings endpoint returns valid response", async ({ request }) => {
    const response = await request.get(`${API_URL}/api/kba/auto-gen/settings`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("enabled");
    expect(data).toHaveProperty("schedule_time");
  });

  test("CSV ticket lookup by incident ID works", async ({ request }) => {
    const response = await request.get(
      `${API_URL}/api/csv-tickets/by-incident/INC000016349327`
    );
    // May be 200 or 404 depending on whether that incident exists in data
    expect([200, 404]).toContain(response.status());
  });
});
