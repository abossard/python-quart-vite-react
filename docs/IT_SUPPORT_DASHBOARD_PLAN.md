# IT Support Dashboard Implementation Plan

## Implementation Progress Tracker

**Status Legend:** ⬜ Not Started | 🟦 In Progress | ✅ Complete

### Step 1: Backend Data Models & Service Layer ⬜
**Goal:** Create Pydantic models and random data generation service

**Tasks:**
- [ ] Create `backend/support_stats.py` with all Pydantic models (TicketStats, CategoryBreakdown, SeverityMetrics, TechnicianPerformance, TimeSeriesData, SystemHealth)
- [ ] Implement `SupportService` class with random data generator methods
- [ ] Build `_generate_random_stats()` helper for ticket statistics
- [ ] Build `_generate_time_series()` helper for hourly/daily patterns
- [ ] Build `_generate_technician_data()` helper for team performance
- [ ] Test data generation in Python REPL—verify randomness and realistic ranges

**Success Criteria:** Running `SupportService().get_ticket_stats()` returns different realistic values on each call

---

### Step 2: Backend API Endpoints (REST + MCP) ⬜
**Goal:** Expose support data through unified operations

**Tasks:**
- [ ] Add `@operation` for `get_support_stats` in `backend/app.py`
- [ ] Add `@operation` for `get_ticket_trends` with period parameter
- [ ] Add `@operation` for `get_category_breakdown`
- [ ] Add `@operation` for `get_severity_metrics`
- [ ] Add `@operation` for `get_technician_performance`
- [ ] Add `@operation` for `get_system_health`
- [ ] Create REST route wrappers for all operations
- [ ] Test all endpoints with curl: `curl http://localhost:5001/api/support/stats`

**Success Criteria:** All 6 endpoints return valid JSON with random mock data; MCP tools/list shows new support operations

---

### Step 3: Backend Real-time SSE Stream ⬜
**Goal:** Create live-updating metrics stream

**Tasks:**
- [ ] Implement `/api/support/live-stream` SSE endpoint in `backend/app.py`
- [ ] Generate random system health metrics every 5 seconds (queue_depth, active_connections, response_time_ms, error_rate)
- [ ] Implement "random walk" algorithm for smooth value transitions
- [ ] Add occasional spikes to simulate incidents (10% chance)
- [ ] Test SSE with curl: `curl -N http://localhost:5001/api/support/live-stream`

**Success Criteria:** Stream emits JSON data every 5 seconds with realistic fluctuating values

---

### Step 4: Frontend API Service Layer ⬜
**Goal:** Connect frontend to backend support APIs

**Tasks:**
- [ ] Install Recharts: `cd frontend && npm install recharts`
- [ ] Extend `frontend/src/services/api.js` with `getSupportStats()`
- [ ] Add `getTicketTrends(period)` function
- [ ] Add `getCategoryBreakdown()` function
- [ ] Add `getSeverityMetrics()` function
- [ ] Add `getTechnicianPerformance()` function
- [ ] Add `getSystemHealth()` function
- [ ] Add `connectToSupportStream(onUpdate, onError)` SSE handler
- [ ] Test API calls in browser console

**Success Criteria:** Can fetch support data from browser: `api.getSupportStats().then(console.log)`

---

### Step 5: Frontend Core Components ⬜
**Goal:** Build reusable dashboard UI components

**Tasks:**
- [ ] Create `frontend/src/features/support-dashboard/` folder
- [ ] Build `MetricCard.jsx` with props (title, value, icon, trend, color, gradient)
- [ ] Build `TicketTrendsChart.jsx` using Recharts LineChart
- [ ] Build `CategoryPieChart.jsx` using Recharts PieChart
- [ ] Build `SeverityBarChart.jsx` using Recharts BarChart
- [ ] Build `TechnicianTable.jsx` using FluentUI DataGrid
- [ ] Build `SystemHealthMonitor.jsx` with live SSE indicators
- [ ] Test each component in isolation with mock props

**Success Criteria:** Each component renders correctly with sample data passed as props

---

### Step 6: Frontend Dashboard Integration ⬜
**Goal:** Assemble complete dashboard with live data

**Tasks:**
- [ ] Create `SupportDashboard.jsx` container component
- [ ] Implement state management (stats, trends, liveHealth, loading, error, timeRange)
- [ ] Fetch all API data on mount with `useEffect`
- [ ] Connect SSE stream for live updates
- [ ] Implement time range selector (24h/7d/30d) with `<Dropdown>`
- [ ] Apply responsive CSS Grid layout (12-column system)
- [ ] Add loading spinners and error states
- [ ] Update `frontend/src/App.jsx` to replace Dashboard tab with SupportDashboard
- [ ] Test in browser: navigate to Dashboard tab, verify all charts load

**Success Criteria:** Dashboard displays all metrics, charts update when time range changes, live indicators pulse with SSE data

---

### Step 7: Styling, Testing & Documentation ⬜
**Goal:** Polish UI and ensure quality

**Tasks:**
- [ ] Apply FluentUI theming to all components (tokens, makeStyles)
- [ ] Add gradient backgrounds to MetricCards
- [ ] Add hover states, tooltips, and smooth transitions
- [ ] Optimize for mobile/tablet (test responsive breakpoints)
- [ ] Add ARIA labels and keyboard navigation support
- [ ] Write `tests/e2e/support-dashboard.spec.js` Playwright test
- [ ] Run E2E test: `npm run test:e2e`
- [ ] Update `README.md` with dashboard feature description
- [ ] Update `docs/PROJECT_STRUCTURE.md` with new files
- [ ] Add screenshots to documentation (optional)

**Success Criteria:** Dashboard looks polished, E2E test passes, documentation updated

---

## Overview

Transform the existing Dashboard component into a comprehensive IT support statistics dashboard featuring modern, interactive graphs and colorful metrics for a fictional computer support department.

---

## 1. Backend Implementation

### 1.1 Data Models (Pydantic)

Create new Pydantic models in `backend/support_stats.py`:

```python
# Models to create:
- TicketStats: Total tickets, open, closed, response time averages
- CategoryBreakdown: Hardware, software, network, other issues
- SeverityMetrics: Critical, high, medium, low priority tickets
- TechnicianPerformance: Individual tech stats, resolved tickets, avg time
- TimeSeriesData: Hourly/daily ticket trends
- SystemHealth: Server uptime, response times, queue depth
```

### 1.2 Service Layer

Implement `SupportService` class with methods:
- `get_ticket_stats()` → TicketStats (generates random realistic values on-the-fly)
- `get_category_breakdown()` → CategoryBreakdown (random distribution with slight variations)
- `get_severity_metrics()` → SeverityMetrics (randomized severity counts)
- `get_technician_performance()` → list[TechnicianPerformance] (random performance metrics)
- `get_time_series_data(period: str)` → TimeSeriesData (generates realistic time-series with trends)
- `get_system_health()` → SystemHealth (live random metrics with realistic bounds)
- `_generate_random_stats()` → Internal helper to create believable fluctuations
- `_generate_time_series()` → Creates realistic hourly/daily patterns with randomness

**Key Design Principle:** All data is generated dynamically using Python's `random` module with realistic constraints (e.g., ticket counts between 100-200/day, satisfaction scores 3.5-5.0, response times 5-30 minutes). No persistent storage—fresh mock data on every request.

### 1.3 API Endpoints

Add unified operations using `@operation` decorator in `backend/app.py`:

```python
@operation(
    name="get_support_stats",
    description="Get comprehensive IT support statistics",
    http_method="GET",
    http_path="/api/support/stats"
)

@operation(
    name="get_ticket_trends",
    description="Get ticket trends over time",
    http_method="GET", 
    http_path="/api/support/trends"
)

# Additional endpoints for categories, severity, technicians, system health
```

### 1.4 Real-time Updates (SSE)

Create new SSE endpoint `/api/support/live-stream` that streams:
- **Randomly generated live metrics** every 5 seconds
- Queue depth: fluctuates between 5-15 with occasional spikes to 20-30
- Active connections: varies 200-300 with random walk pattern
- Response time: oscillates 100-200ms with occasional latency spikes
- Error rate: stays low (0.05-0.25%) with rare bursts to simulate incidents
- **Simulated ticket events**: Random "new ticket" notifications with fake titles and severities
- All values generated on-the-fly to create realistic dashboard activity

---

## 2. Frontend Implementation

### 2.1 Component Structure

Create new feature folder: `frontend/src/features/support-dashboard/`

**Files to create:**
```
support-dashboard/
├── SupportDashboard.jsx         # Main dashboard container
├── MetricCard.jsx               # Reusable card for KPIs
├── TicketTrendsChart.jsx        # Line/area chart for trends
├── CategoryPieChart.jsx         # Pie/donut chart for categories
├── SeverityBarChart.jsx         # Bar chart for severity levels
├── TechnicianTable.jsx          # Performance table/grid
├── SystemHealthMonitor.jsx      # Real-time health indicators
└── styles.js                    # Shared styles using makeStyles
```

### 2.2 Chart Library Selection

**Recommended: Recharts**
- Pure React components
- Good TypeScript support
- Works well with FluentUI theming
- Responsive and accessible

**Installation:**
```bash
cd frontend && npm install recharts
```

**Alternative options:**
- Chart.js with react-chartjs-2
- Victory (Formidable Labs)
- Nivo (comprehensive but heavier)

### 2.3 Visual Design Elements

#### 2.3.1 Colorful Metric Cards

Large number displays with:
- Gradient backgrounds (FluentUI tokens)
- Icon indicators (from @fluentui/react-icons)
- Trend arrows (up/down indicators)
- Color coding: green (good), yellow (warning), red (critical)

**Metrics to display:**
- Total tickets (24h/7d/30d)
- Open tickets (with percentage)
- Average resolution time
- Customer satisfaction score
- First response time
- Queue depth
- System uptime percentage
- Active technicians

#### 2.3.2 Interactive Charts

**Ticket Trends Chart (Line/Area):**
- X-axis: Time (hourly for 24h, daily for 7d/30d)
- Y-axis: Ticket count
- Multiple series: Created, Resolved, Escalated
- Tooltip showing exact values on hover
- Zoom/pan for historical data

**Category Breakdown (Donut Chart):**
- Hardware (blue): 35%
- Software (purple): 30%
- Network (green): 20%
- Security (red): 10%
- Other (gray): 5%
- Interactive legend with click to filter
- Center label showing total

**Severity Distribution (Stacked Bar):**
- Critical (red)
- High (orange)
- Medium (yellow)
- Low (green)
- Horizontal bars with percentage labels

**Technician Performance (Table + Mini Charts):**
- Name, avatar
- Tickets resolved (with sparkline)
- Avg resolution time
- Customer rating (star display)
- Current status (online/away/offline)

#### 2.3.3 Real-time Indicators

**Live System Health:**
- Pulsing dot indicators (green/yellow/red)
- Server response time gauge
- Active connections counter
- Error rate meter
- Queue depth with color thresholds

**Recent Activity Feed:**
- Last 5-10 ticket updates
- Auto-scroll/fade animations
- Severity color coding
- Relative timestamps ("2 min ago")

### 2.4 Layout & Responsiveness

Use CSS Grid with FluentUI tokens:

```jsx
const useStyles = makeStyles({
  dashboard: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, 1fr)',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalL,
  },
  // Metric cards: 3 columns on desktop, stack on mobile
  metricGrid: {
    gridColumn: 'span 12',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: tokens.spacingVerticalM,
  },
  // Charts: flexible sizing
  chartCard: {
    gridColumn: { '@media (min-width: 768px)': 'span 6', default: 'span 12' },
  },
})
```

**Proposed Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Metric Cards (4 across)                              │
│  [Total] [Open] [Avg Time] [Satisfaction]            │
├──────────────────────┬───────────────────────────────┤
│  Ticket Trends       │  Category Breakdown           │
│  (Line Chart)        │  (Donut Chart)                │
├──────────────────────┼───────────────────────────────┤
│  Severity Dist.      │  System Health                │
│  (Bar Chart)         │  (Live Indicators)            │
├──────────────────────┴───────────────────────────────┤
│  Technician Performance Table                        │
│  (DataGrid with sparklines)                          │
└──────────────────────────────────────────────────────┘
```

### 2.5 State Management

Use React hooks pattern (consistent with existing code):

```jsx
// In SupportDashboard.jsx
const [stats, setStats] = useState(null)
const [trends, setTrends] = useState(null)
const [liveHealth, setLiveHealth] = useState(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState(null)
const [timeRange, setTimeRange] = useState('24h') // '24h', '7d', '30d'
```

### 2.6 API Service Layer

Extend `frontend/src/services/api.js`:

```javascript
// New functions to add:
export async function getSupportStats() { ... }
export async function getTicketTrends(period = '24h') { ... }
export async function getCategoryBreakdown() { ... }
export async function getSeverityMetrics() { ... }
export async function getTechnicianPerformance() { ... }
export async function getSystemHealth() { ... }

// SSE connection
export function connectToSupportStream(onUpdate, onError) { ... }
```

---

## 3. Mock Data Generation Strategy

### 3.1 Fictional IT Support Scenario

**Company:** "TechCorp Solutions" (500 employees)
**Support Team:** 8 technicians with randomized names
**Ticket Volume:** ~150 tickets/day (randomized ±20% on each request)
**Operating Hours:** 24/7 with on-call rotation

**All data is MOCK DATA generated randomly on every API call—no database, no persistence.**

### 3.2 Random Data Generation Ranges

```python
# In SupportService - random value ranges:

TicketStats (generated fresh each request):
  total_24h: random(140, 180)
  total_7d: random(850, 950)
  total_30d: random(4000, 4500)
  open: random(35, 55)
  in_progress: random(18, 28)
  resolved_24h: random(95, 125)
  avg_resolution_time_minutes: random(210, 330)  # 3.5-5.5 hours
  avg_first_response_minutes: random(8, 18)
  satisfaction_score: random(3.8, 4.5) rounded to 1 decimal
  uptime_percent: random(99.85, 99.99)
  
CategoryBreakdown (percentages with slight random variance):
  hardware: ~35% ± 3%
  software: ~30% ± 3%
  network: ~20% ± 2%
  security: ~10% ± 2%
  other: ~5% ± 1%
  # Total normalized to 100%
  
SeverityMetrics (random counts maintaining realistic ratios):
  critical: 2-4% of total
  high: 15-22% of total
  medium: 45-52% of total
  low: 28-35% of total
  
SystemHealth (live random values with bounds):
  uptime: random(99.85, 99.99)
  avg_response_time_ms: random(120, 180) with occasional spikes to 250-400
  active_connections: random(200, 280)
  queue_depth: random(5, 12) with 10% chance of spike to 20-35
  error_rate: random(0.05, 0.20)% with rare spikes to 0.8-1.5%
  
TechnicianPerformance (8 fictional techs with random stats):
  - Names: ["Sarah Chen", "Mike Rodriguez", "Emily Watson", "James Kim", 
            "Lisa Patel", "Tom Anderson", "Nina Williams", "Alex Kumar"]
  - resolved_24h: random(10, 22) per technician
  - avg_time_minutes: random(200, 350)
  - rating: random(4.0, 5.0) rounded to 1 decimal
  - status: randomly "online" (60%), "away" (25%), "offline" (15%)
```

### 3.3 Time Series Data Generation

**Algorithm for realistic time patterns:**

```python
def _generate_time_series(period: str) -> list:
    """Generate random but realistic time-series data"""
    
    # Define base patterns
    if period == '24h':
        hours = 24
        base_pattern = [
            3,3,2,2,2,1,2,4,  # Midnight-7AM (low activity)
            8,12,14,12,        # 8AM-11AM (morning peak)
            10,9,11,13,        # Noon-3PM (afternoon activity)
            12,10,8,6,         # 4PM-7PM (end of day)
            5,4,4,3            # 8PM-11PM (evening decline)
        ]
    elif period == '7d':
        hours = 7
        base_pattern = [140, 155, 148, 162, 158, 95, 82]  # Mon-Sun
    else:  # 30d
        hours = 30
        base_pattern = [random(130, 170) for _ in range(30)]
    
    # Add realistic randomness
    data = []
    for base_value in base_pattern:
        created = int(base_value * random.uniform(0.85, 1.15))
        resolved = int(created * random.uniform(0.70, 0.95))  # ~80% resolution
        escalated = int(created * random.uniform(0.02, 0.08))  # 2-8% escalation
        
        data.append({
            'timestamp': calculate_timestamp(...),
            'created': created,
            'resolved': resolved,
            'escalated': escalated
        })
    
    return data
```

**Key features:**
- Peak hours: 9-11 AM, 2-4 PM (multiplier 1.5-2.0x)
- Low activity: 12-6 AM (multiplier 0.3-0.5x)
- Weekend dip: Sat/Sun have ~40% less tickets
- Random variance: ±15% on all values
- Occasional spikes: 5% chance of 2-3x spike (simulated incident)
- Correlated metrics: Resolved tickets lag behind created by ~10-20%

---

## 4. Integration Steps

### 4.1 Phase 1: Backend Foundation (Day 1-2)
1. Create `backend/support_stats.py` with Pydantic models
2. Implement `SupportService` class with **random data generators** (no persistence)
3. Build `_generate_random_stats()`, `_generate_time_series()`, `_generate_technician_data()` helpers
4. Add `@operation` decorated endpoints to `backend/app.py`
5. Test endpoints with curl/Postman—verify data is different on each call
6. Create SSE endpoint that generates fresh random metrics every 5 seconds

### 4.2 Phase 2: Frontend Components (Day 3-4)
1. Install Recharts: `cd frontend && npm install recharts`
2. Create feature folder structure
3. Build `MetricCard.jsx` component (reusable)
4. Build individual chart components (one at a time)
5. Create `SupportDashboard.jsx` container

### 4.3 Phase 3: API Integration (Day 5)
1. Extend `frontend/src/services/api.js` with support endpoints
2. Connect dashboard to backend APIs
3. Implement SSE connection for live updates
4. Add loading states and error handling
5. Test data flow end-to-end

### 4.4 Phase 4: Styling & UX (Day 6)
1. Apply FluentUI theming to all components
2. Add color coding and visual hierarchy
3. Implement responsive layout with CSS Grid
4. Add hover states, tooltips, transitions
5. Optimize for mobile/tablet views

### 4.5 Phase 5: Polish & Testing (Day 7)
1. Add time range selector (24h/7d/30d)
2. Implement refresh functionality
3. Add accessibility attributes (ARIA labels)
4. Write Playwright E2E tests for dashboard
5. Performance optimization (memoization, lazy loading)

---

## 5. Technical Considerations

### 5.1 Performance Optimization

- Use `React.memo()` for chart components
- Debounce SSE updates (max 1/sec)
- Implement virtual scrolling for large tables
- Lazy load chart library chunks
- Cache API responses with timestamps

### 5.2 Accessibility

- ARIA labels for all interactive elements
- Keyboard navigation for charts
- Screen reader descriptions for metrics
- High contrast color modes
- Focus indicators on cards/buttons

### 5.3 Error Handling

- Graceful degradation if SSE connection fails
- Retry logic for failed API calls
- Empty state UI when no data available
- User-friendly error messages
- Fallback to cached data during outages

### 5.4 Testing Strategy

**Unit Tests:**
- Pure calculation functions (stats aggregation)
- Pydantic model validation
- Chart data transformation helpers

**Integration Tests:**
- API endpoint responses
- SSE stream formatting
- Frontend API service methods

**E2E Tests (Playwright):**
```javascript
// tests/e2e/support-dashboard.spec.js
test('displays IT support metrics correctly', async ({ page }) => {
  await page.goto('http://localhost:3001')
  await page.click('[data-testid="dashboard-tab"]')
  
  // Verify metric cards loaded
  await expect(page.locator('[data-testid="total-tickets"]')).toBeVisible()
  
  // Verify charts rendered
  await expect(page.locator('[data-testid="trends-chart"]')).toBeVisible()
  
  // Test time range selector
  await page.selectOption('[data-testid="time-range"]', '7d')
  await expect(page.locator('[data-testid="trends-chart"]')).toContainText('7 days')
})
```

---

## 6. Future Enhancements

### 6.1 Short-term (Post-MVP)
- Export dashboard as PDF/PNG
- Email reports scheduling
- Custom date range picker
- Drill-down into specific tickets
- Filter by technician/category/severity

### 6.2 Long-term
- Machine learning predictions (ticket volume forecasting)
- Anomaly detection alerts
- Multi-tenant support (different departments)
- Integration with real ticketing systems (Jira, ServiceNow)
- Historical trend analysis (year-over-year)

---

## 7. Dependencies to Add

### Backend
```txt
# Already available in requirements.txt:
# - quart
# - pydantic
# Python standard library modules needed:
# - random (for mock data generation)
# - datetime (for timestamps)
# - time (for SSE intervals)
# No new dependencies needed!
```

### Frontend
```json
{
  "dependencies": {
    "recharts": "^2.10.3"
  }
}
```

---

## 8. File Checklist

### New Files to Create

**Backend:**
- [ ] `backend/support_stats.py` - Pydantic models & SupportService
- [ ] Update `backend/app.py` - Add support endpoints

**Frontend:**
- [ ] `frontend/src/features/support-dashboard/SupportDashboard.jsx`
- [ ] `frontend/src/features/support-dashboard/MetricCard.jsx`
- [ ] `frontend/src/features/support-dashboard/TicketTrendsChart.jsx`
- [ ] `frontend/src/features/support-dashboard/CategoryPieChart.jsx`
- [ ] `frontend/src/features/support-dashboard/SeverityBarChart.jsx`
- [ ] `frontend/src/features/support-dashboard/TechnicianTable.jsx`
- [ ] `frontend/src/features/support-dashboard/SystemHealthMonitor.jsx`
- [ ] Update `frontend/src/services/api.js` - Add support API functions
- [ ] Update `frontend/src/App.jsx` - Add Support Dashboard tab

**Tests:**
- [ ] `tests/e2e/support-dashboard.spec.js`

**Documentation:**
- [ ] Update `README.md` - Document new dashboard feature
- [ ] Update `docs/PROJECT_STRUCTURE.md` - Add support dashboard section

---

## 9. Color Palette Specification

### 9.1 FluentUI Token Mappings

```javascript
// Use FluentUI design tokens for consistency:
const colors = {
  // Status colors
  success: tokens.colorPaletteGreenForeground1,     // #107c10
  warning: tokens.colorPaletteYellowForeground1,    // #fde300
  error: tokens.colorPaletteRedForeground1,         // #d13438
  info: tokens.colorPaletteBlueForeground1,         // #0078d4
  
  // Category colors
  hardware: tokens.colorPaletteBlueForeground1,     // Blue
  software: tokens.colorPalettePurpleForeground1,   // Purple
  network: tokens.colorPaletteGreenForeground1,     // Green
  security: tokens.colorPaletteRedForeground1,      // Red
  other: tokens.colorNeutralForeground3,            // Gray
  
  // Severity colors
  critical: '#d13438',  // Red
  high: '#f7630c',      // Orange
  medium: '#fde300',    // Yellow
  low: '#107c10',       // Green
  
  // Gradient backgrounds for metric cards
  gradients: {
    primary: `linear-gradient(135deg, ${tokens.colorBrandBackground} 0%, ${tokens.colorBrandBackground2} 100%)`,
    success: `linear-gradient(135deg, #107c10 0%, #0b6a0b 100%)`,
    warning: `linear-gradient(135deg, #f7630c 0%, #ca5010 100%)`,
    info: `linear-gradient(135deg, #0078d4 0%, #004578 100%)`,
  }
}
```

### 9.2 Chart Theme Configuration

```javascript
// Recharts theme customization
const chartTheme = {
  fontFamily: tokens.fontFamilyBase,
  fontSize: tokens.fontSizeBase300,
  colors: [
    tokens.colorPaletteBlueForeground1,
    tokens.colorPalettePurpleForeground1,
    tokens.colorPaletteGreenForeground1,
    tokens.colorPaletteOrangeForeground1,
    tokens.colorPaletteTealForeground1,
  ],
  grid: {
    stroke: tokens.colorNeutralStroke2,
    strokeDasharray: '3 3',
  },
  tooltip: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderColor: tokens.colorNeutralStroke1,
    color: tokens.colorNeutralForeground1,
  }
}
```

---

## 10. Success Criteria

### 10.1 Functional Requirements
- ✅ Dashboard displays at least 6 key metrics with large colorful numbers
- ✅ At least 3 different chart types (line, pie/donut, bar)
- ✅ Real-time updates via SSE (system health indicators)
- ✅ Responsive layout (desktop, tablet, mobile)
- ✅ Time range selector (24h, 7d, 30d)
- ✅ All data sourced from backend API (no hardcoded values in frontend)

### 10.2 Quality Requirements
- ✅ Follows existing architecture patterns (`@operation`, Pydantic, feature-first)
- ✅ Uses FluentUI components and theming consistently
- ✅ Accessible (keyboard navigation, ARIA labels, screen reader friendly)
- ✅ Error handling for failed API calls and SSE disconnections
- ✅ Loading states for async operations
- ✅ E2E test coverage for critical user flows

### 10.3 Performance Targets
- ✅ Dashboard loads in <2 seconds
- ✅ Charts render smoothly (60fps animations)
- ✅ SSE updates don't cause UI jank
- ✅ Memory-efficient (no leaks in long-running sessions)

---

## 11. Risk Assessment

### 11.1 Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Chart library bundle size | High load time | Code-split Recharts, lazy load charts |
| SSE connection instability | Stale data | Implement reconnection logic, fallback polling |
| Mobile performance | Poor UX on phones | Simplify mobile layout, reduce chart complexity |
| Browser compatibility | Broken features | Test on Chrome, Firefox, Safari; polyfills if needed |

### 11.2 Scope Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Feature creep | Delayed delivery | Stick to MVP, document enhancements for v2 |
| Over-engineering | Complexity debt | Use existing patterns, avoid premature optimization |
| Inadequate sample data | Unrealistic demo | Review sample data with stakeholders, iterate |

---

## 12. Timeline Estimate

**Total Duration:** 7 working days (assuming 1 developer, 6-8 hours/day)

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: Backend | 2 days | Working API endpoints with sample data |
| Phase 2: Frontend Components | 2 days | Individual chart components functional |
| Phase 3: Integration | 1 day | Dashboard connected to backend |
| Phase 4: Styling & UX | 1 day | Polished, responsive UI |
| Phase 5: Testing & Polish | 1 day | E2E tests, bug fixes, documentation |

**Contingency Buffer:** +1 day for unexpected issues

---

## 13. Next Steps

### Immediate Actions (Before Coding)
1. ✅ Review and approve this plan
2. Create GitHub issue/ticket for tracking
3. Set up branch: `git checkout -b feature/it-support-dashboard`
4. Review Recharts documentation and examples
5. Sketch UI mockups (optional, can use text descriptions)

### Implementation Order
1. Start with backend (data models → service → endpoints)
2. Test backend thoroughly (curl, Postman, or Python REPL)
3. Build one chart component end-to-end (proof of concept)
4. Iterate on remaining components
5. Polish and test

---

## 14. Questions to Resolve

Before implementation begins:

1. **Data Retention:** Should historical data persist between server restarts, or is in-memory sufficient for demo?
   - **Recommendation:** In-memory with **no persistence**—all data is randomly generated on-the-fly for realistic demo appearance

2. **Real-time Frequency:** How often should SSE push updates?
   - **Recommendation:** Every 5 seconds with fresh random values to simulate live activity

3. **Chart Interactivity:** Should charts have click-to-drill-down functionality?
   - **Recommendation:** Defer to Phase 2, keep MVP simple

4. **Tab Integration:** Replace existing Dashboard tab or add new "Support" tab?
   - **Recommendation:** Replace existing Dashboard (or rename to "IT Support Dashboard")

5. **MCP Integration:** Should support stats be exposed via MCP tools?
   - **Recommendation:** Yes, use `@operation` decorator for consistency

---

## Appendix A: Sample API Response Formats

**Note:** All values below are examples. Actual API responses will contain **randomly generated values** within realistic ranges on every request.

### GET /api/support/stats
```json
{
  "total_24h": 156,      // random(140, 180)
  "total_7d": 892,       // random(850, 950)
  "total_30d": 4234,     // random(4000, 4500)
  "open": 47,            // random(35, 55)
  "in_progress": 23,     // random(18, 28)
  "resolved_24h": 109,   // random(95, 125)
  "avg_resolution_time_minutes": 263,  // random(210, 330)
  "avg_first_response_minutes": 12,    // random(8, 18)
  "satisfaction_score": 4.2,           // random(3.8, 4.5)
  "uptime_percent": 99.97              // random(99.85, 99.99)
}
```

### GET /api/support/trends?period=24h
```json
{
  "period": "24h",
  "interval": "hourly",
  "data": [
    {
      "timestamp": "2025-11-26T00:00:00Z",
      "created": 3,      // Generated using time-based pattern + randomness
      "resolved": 2,     // ~70-95% of created
      "escalated": 0     // 2-8% of created
    },
    {
      "timestamp": "2025-11-26T01:00:00Z",
      "created": 2,      // Low activity hours (midnight-6AM)
      "resolved": 1,
      "escalated": 0
    },
    {
      "timestamp": "2025-11-26T09:00:00Z",
      "created": 14,     // Peak morning hours (9-11AM)
      "resolved": 11,
      "escalated": 1
    }
    // ... 24 hourly data points, all randomly generated with realistic patterns
  ]
}
// Note: Data is regenerated on each request with different random values
```

### GET /api/support/categories
```json
{
  "categories": [
    // Percentages vary slightly on each request (e.g., 35% ± 3%)
    {"name": "Hardware", "count": 520, "percentage": 35.0, "color": "#0078d4"},
    {"name": "Software", "count": 450, "percentage": 30.0, "color": "#8764b8"},
    {"name": "Network", "count": 298, "percentage": 20.0, "color": "#107c10"},
    {"name": "Security", "count": 149, "percentage": 10.0, "color": "#d13438"},
    {"name": "Other", "count": 75, "percentage": 5.0, "color": "#605e5c"}
  ],
  "total": 1492  // Sum of counts, normalized percentages
}
// Algorithm: Generate random total (1400-1600), distribute by percentages with variance
```

### SSE /api/support/live-stream
```
// Sent every 5 seconds with freshly generated random values

data: {"queue_depth": 8, "active_connections": 234, "response_time_ms": 145, "error_rate": 0.12, "timestamp": "2025-11-26T14:23:45Z"}

data: {"queue_depth": 9, "active_connections": 237, "response_time_ms": 152, "error_rate": 0.14, "timestamp": "2025-11-26T14:23:50Z"}

data: {"queue_depth": 7, "active_connections": 241, "response_time_ms": 138, "error_rate": 0.09, "timestamp": "2025-11-26T14:23:55Z"}

// Values use "random walk" algorithm: new_value = previous_value ± random_delta
// Queue depth: walks between 5-15, occasional spikes to 25-35
// Connections: walks between 200-280
// Response time: walks 120-180ms, spikes to 250-400ms (5% chance)
// Error rate: walks 0.05-0.25%, rare spikes to 1.0-1.5% (2% chance)
```

---

## Appendix B: Component Interface Specifications

### MetricCard.jsx Props
```typescript
interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ComponentType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info';
  gradient?: boolean;
  loading?: boolean;
}
```

### TicketTrendsChart.jsx Props
```typescript
interface TicketTrendsChartProps {
  data: Array<{
    timestamp: string;
    created: number;
    resolved: number;
    escalated: number;
  }>;
  period: '24h' | '7d' | '30d';
  loading?: boolean;
  onPeriodChange?: (period: string) => void;
}
```

---

**End of Plan**

This document should serve as a comprehensive blueprint for implementing the IT Support Dashboard. All decisions follow the existing architectural patterns and coding conventions established in the project.
