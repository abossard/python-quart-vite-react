const VPN_DEFAULT_PROMPT = `Find VPN issues where you think it's more a skill issue than a technical issue.`

const OPS_DEFAULT_PROMPT = `Analysiere Tickets zu "Outlook" oder "E-Mail" und erstelle einen einzigen Operations-Usecase.
Liefere nur eine kurze, handlungsorientierte Zusammenfassung mit Prioritäten und nächstem Schritt.
Nutze ausschließlich CSV-Daten und nenne die verwendeten Ticket-IDs in Fließtext.`

/**
 * Add new demos here to create additional pages without duplicating UI logic.
 * Each definition configures route, prompt, and which result views are rendered.
 */
export const USECASE_DEMO_DEFINITIONS = [
  {
    id: 'usecase-demo-1',
    route: '/usecase_demo_1',
    tabValue: 'usecase-demo',
    tabLabel: 'Usecase Demo',
    tabTestId: 'tab-usecase-demo',
    testIdPrefix: 'usecase-demo',
    title: 'Usecase Demo Description',
    menuPointBadge: '1 menu point',
    pageDescription:
      'This page documents one usecase demo menu point: summary first, then editable agent prompt, then background execution and results.',
    promptLabel: 'Agent Prompt',
    promptDescription: 'Edit the prompt, then start the agent run in the background.',
    defaultPrompt: VPN_DEFAULT_PROMPT,
    runHistoryLimit: 25,
    pollIntervalMs: 2000,
    resultViews: ['table', 'markdown'],
    resultSectionTitle: 'Agent Results',
    resultSectionDescription:
      'Configured result views are rendered below based on this demo definition.',
    ticketIdFields: ['ticket_ids', 'ticket_id', 'ticketIds'],
    matchingTickets: {
      enabled: true,
      title: 'Matching Tickets',
      description:
        'Ticket IDs from the agent result are resolved against CSV data. Click a ticket to inspect details.',
      fields: [
        'id',
        'summary',
        'status',
        'priority',
        'assignee',
        'assigned_group',
        'requester_name',
        'city',
        'service',
        'description',
        'notes',
        'resolution',
        'created_at',
        'updated_at',
      ],
    },
  },
  {
    id: 'usecase-demo-ops',
    route: '/usecase_demo_ops',
    tabValue: 'usecase-demo-ops',
    tabLabel: 'Ops Demo',
    tabTestId: 'tab-usecase-demo-ops',
    testIdPrefix: 'ops-demo',
    title: 'Operations Usecase Demo',
    menuPointBadge: '1 menu point',
    pageDescription:
      'This demo focuses on operational triage outcomes with a concise narrative output.',
    promptLabel: 'Operations Prompt',
    promptDescription: 'Adjust the ops prompt and run the agent in background.',
    defaultPrompt: OPS_DEFAULT_PROMPT,
    runHistoryLimit: 25,
    pollIntervalMs: 2000,
    resultViews: ['markdown'],
    resultSectionTitle: 'Operations Result',
    resultSectionDescription:
      'This demo is configured for concise narrative output only.',
    ticketIdFields: ['ticket_ids', 'ticket_id', 'ticketIds'],
    matchingTickets: {
      enabled: false,
    },
  },
]

export const DEFAULT_USECASE_DEMO_DEFINITION = USECASE_DEMO_DEFINITIONS[0]
