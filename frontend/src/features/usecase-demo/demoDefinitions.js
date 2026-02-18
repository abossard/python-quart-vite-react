const VPN_DEFAULT_PROMPT = `Find VPN issues where you think it's more a skill issue than a technical issue.

For speed:
- First call csv_search_tickets with fields="id,summary,status,priority,assignee,assigned_group,created_at" and limit=20.
- Use csv_get_ticket only for the top 3-5 most relevant IDs when deeper context is required.
- Stop after the first sufficient result set; avoid extra tool loops.
- Do not request notes or resolution by default; only request them when explicitly needed for evidence.`;

const OPS_DEFAULT_PROMPT = `Analysiere Tickets zu "Outlook" oder "E-Mail" und erstelle einen einzigen Operations-Usecase.
Für schnelle Ausführung:
- Nutze zuerst csv_search_tickets mit fields="id,summary,status,priority,assigned_group,created_at" und limit=20.
- Nutze csv_get_ticket nur für wenige ausgewählte Ticket-IDs, wenn Details nötig sind.
- Beende nach dem ersten ausreichenden Datensatz und vermeide zusätzliche Tool-Schleifen.
- Fordere notes/resolution nicht standardmäßig an, nur wenn sie für die Aussage zwingend notwendig sind.
Liefere nur eine kurze, handlungsorientierte Zusammenfassung mit Prioritäten und nächstem Schritt.
Nutze ausschließlich CSV-Daten und nenne die verwendeten Ticket-IDs in Fließtext.`;

const SLA_BREACH_DEFAULT_PROMPT = `Use the csv_sla_breach_tickets tool to retrieve all unassigned tickets at SLA risk.

Call it with default parameters (unassigned_only=true, include_ok=false). The tool returns a pre-computed SlaBreachReport with:
- reference_timestamp: the anchor date used for age calculations (max date in the dataset)
- total_breached / total_at_risk: summary counts
- tickets: list of TicketSlaInfo objects already grouped (breached → at_risk) and sorted by age_hours descending

Output the tickets array as a JSON block with these fields per row:
  ticket_id, priority, urgency, assigned_group, reported_date, age_hours, sla_threshold_hours, breach_status

After the JSON block, provide a short markdown summary that:
1. States the reference_timestamp used
2. Groups ticket counts by breach_status and assigned_group
3. Recommends actions for the most critical breaches`;

/**
 * Add new demos here to create additional pages without duplicating UI logic.
 * Each definition configures route, prompt, and which result views are rendered.
 */
export const USECASE_DEMO_DEFINITIONS = [
  {
    id: "usecase-demo-1",
    route: "/usecase_demo_1",
    tabValue: "usecase-demo",
    tabLabel: "Usecase Demo",
    tabTestId: "tab-usecase-demo",
    testIdPrefix: "usecase-demo",
    title: "Usecase Demo Description",
    menuPointBadge: "1 menu point",
    pageDescription:
      "This page documents one usecase demo menu point: summary first, then editable agent prompt, then background execution and results.",
    promptLabel: "Agent Prompt",
    promptDescription:
      "Edit the prompt, then start the agent run in the background.",
    defaultPrompt: VPN_DEFAULT_PROMPT,
    runHistoryLimit: 25,
    pollIntervalMs: 2000,
    resultViews: ["table", "markdown"],
    resultSectionTitle: "Agent Results",
    resultSectionDescription:
      "Configured result views are rendered below based on this demo definition.",
    ticketIdFields: ["ticket_ids", "ticket_id", "ticketIds"],
    matchingTickets: {
      enabled: true,
      title: "Matching Tickets",
      description:
        "Ticket IDs from the agent result are resolved against CSV data. Click a ticket to inspect details.",
      fields: [
        "id",
        "summary",
        "status",
        "priority",
        "assignee",
        "assigned_group",
        "requester_name",
        "city",
        "service",
        "description",
        "notes",
        "resolution",
        "created_at",
        "updated_at",
      ],
    },
  },
  {
    id: "usecase-demo-ops",
    route: "/usecase_demo_ops",
    tabValue: "usecase-demo-ops",
    tabLabel: "Ops Demo",
    tabTestId: "tab-usecase-demo-ops",
    testIdPrefix: "ops-demo",
    title: "Operations Usecase Demo",
    menuPointBadge: "1 menu point",
    pageDescription:
      "This demo focuses on operational triage outcomes with a concise narrative output.",
    promptLabel: "Operations Prompt",
    promptDescription: "Adjust the ops prompt and run the agent in background.",
    defaultPrompt: OPS_DEFAULT_PROMPT,
    runHistoryLimit: 25,
    pollIntervalMs: 2000,
    resultViews: ["markdown"],
    resultSectionTitle: "Operations Result",
    resultSectionDescription:
      "This demo is configured for concise narrative output only.",
    ticketIdFields: ["ticket_ids", "ticket_id", "ticketIds"],
    matchingTickets: {
      enabled: false,
    },
  },
  {
    id: "usecase-demo-sla-breach",
    route: "/usecase_demo_sla_breach",
    tabValue: "usecase-demo-sla-breach",
    tabLabel: "SLA Breach Risk",
    tabTestId: "tab-usecase-demo-sla-breach",
    testIdPrefix: "sla-breach",
    title: "SLA Breach Risk",
    menuPointBadge: "1 menu point",
    pageDescription:
      "Identifies tickets assigned to a support group but with no individual assignee, that are approaching or have exceeded priority-based SLA thresholds. Helps teams prioritize pickup before service level agreements are breached.",
    promptLabel: "SLA Breach Prompt",
    promptDescription:
      "Edit thresholds or filters in the prompt, then run the agent to scan for at-risk tickets.",
    defaultPrompt: SLA_BREACH_DEFAULT_PROMPT,
    runHistoryLimit: 25,
    pollIntervalMs: 2000,
    resultViews: ["sla-breach", "markdown"],
    resultSectionTitle: "SLA Breach Results",
    resultSectionDescription:
      "Tickets at risk or already past their SLA threshold, sorted by severity.",
    ticketIdFields: ["ticket_ids", "ticket_id", "ticketIds"],
    // Tickets are shown inline in the sla-breach result view; disable the separate card.
    matchingTickets: {
      enabled: true,
      title: "Affected Tickets (Group-Assigned, No Individual Assignee)",
      description:
        'These tickets are routed to a support group but no individual has picked them up. The "Assigned Group" column shows the responsible team; "Assignee" is empty for all.',
      fields: [
        "id",
        "summary",
        "assigned_group",
        "assignee",
        "status",
        "priority",
        "urgency",
        "reported_date",
        "last_modified_date",
        "requester_name",
        "service",
      ],
    },
  },
];

export const DEFAULT_USECASE_DEMO_DEFINITION = USECASE_DEMO_DEFINITIONS[0];
