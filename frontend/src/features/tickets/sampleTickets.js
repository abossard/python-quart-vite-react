// Sample ticket aggregates for Nivo demos
// Replace with real data by fetching/parsing CSV or calling backend when available.

export const ticketsByStatus = [
  { id: "New", label: "New", value: 12 },
  { id: "Assigned", label: "Assigned", value: 18 },
  { id: "In Progress", label: "In Progress", value: 27 },
  { id: "Pending", label: "Pending", value: 9 },
  { id: "Resolved", label: "Resolved", value: 33 },
  { id: "Closed", label: "Closed", value: 21 },
  { id: "Cancelled", label: "Cancelled", value: 4 },
];

export const ticketsByPriority = [
  { priority: "Critical", count: 3 },
  { priority: "High", count: 14 },
  { priority: "Medium", count: 52 },
  { priority: "Low", count: 22 },
];

export const ticketsTimeline = [
  { x: "2025-10-20", y: 5 },
  { x: "2025-10-25", y: 18 },
  { x: "2025-11-01", y: 32 },
  { x: "2025-11-10", y: 41 },
  { x: "2025-11-20", y: 58 },
  { x: "2025-11-30", y: 63 },
  { x: "2025-12-10", y: 71 },
];

export const ticketsTimelineSeries = [
  {
    id: "Tickets Reported",
    data: ticketsTimeline,
  },
];

export const ticketsSankey = {
  nodes: [
    { id: "New" },
    { id: "Assigned" },
    { id: "In Progress" },
    { id: "Pending" },
    { id: "Resolved" },
    { id: "Closed" },
    { id: "Cancelled" },
    { id: "Critical" },
    { id: "High" },
    { id: "Medium" },
    { id: "Low" },
  ],
  links: [
    { source: "New", target: "Assigned", value: 18 },
    { source: "New", target: "Cancelled", value: 2 },
    { source: "Assigned", target: "In Progress", value: 15 },
    { source: "Assigned", target: "Pending", value: 3 },
    { source: "In Progress", target: "Resolved", value: 13 },
    { source: "In Progress", target: "Cancelled", value: 2 },
    { source: "Pending", target: "Resolved", value: 2 },
    { source: "Resolved", target: "Closed", value: 12 },
    // Status -> Priority mapping sample
    { source: "New", target: "High", value: 4 },
    { source: "New", target: "Medium", value: 6 },
    { source: "Assigned", target: "Critical", value: 3 },
    { source: "Assigned", target: "High", value: 5 },
    { source: "In Progress", target: "Medium", value: 7 },
    { source: "Resolved", target: "Low", value: 6 },
  ],
};

export const ticketsStreamData = [
  {
    x: "2025-10-20",
    New: 5,
    Assigned: 3,
    "In Progress": 1,
    Pending: 0,
    Resolved: 0,
    Closed: 0,
    Cancelled: 0,
  },
  {
    x: "2025-10-25",
    New: 8,
    Assigned: 6,
    "In Progress": 3,
    Pending: 1,
    Resolved: 0,
    Closed: 0,
    Cancelled: 1,
  },
  {
    x: "2025-11-01",
    New: 6,
    Assigned: 8,
    "In Progress": 6,
    Pending: 2,
    Resolved: 1,
    Closed: 0,
    Cancelled: 1,
  },
  {
    x: "2025-11-10",
    New: 5,
    Assigned: 9,
    "In Progress": 8,
    Pending: 3,
    Resolved: 4,
    Closed: 1,
    Cancelled: 1,
  },
  {
    x: "2025-11-20",
    New: 4,
    Assigned: 7,
    "In Progress": 10,
    Pending: 3,
    Resolved: 6,
    Closed: 3,
    Cancelled: 1,
  },
  {
    x: "2025-11-30",
    New: 3,
    Assigned: 5,
    "In Progress": 9,
    Pending: 2,
    Resolved: 8,
    Closed: 6,
    Cancelled: 1,
  },
  {
    x: "2025-12-10",
    New: 2,
    Assigned: 4,
    "In Progress": 6,
    Pending: 1,
    Resolved: 10,
    Closed: 8,
    Cancelled: 1,
  },
];

export const ticketsStreamKeys = [
  "New",
  "Assigned",
  "In Progress",
  "Pending",
  "Resolved",
  "Closed",
  "Cancelled",
];
