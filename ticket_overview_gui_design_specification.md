# Ticket Overview GUI – Design Specification

## Overview
This document describes the layout, alignment, and color system for the **Ticket Overview GUI**. The interface is designed for clarity, scalability, and efficient ticket triage, with a strong visual hierarchy between complex and straightforward tickets.

---

## Overall Layout Structure

The GUI follows a vertical, top-down structure with consistent horizontal alignment and spacing.

```
┌───────────────────────────────────────────────┐
│ Top Filter Bar                                │
├───────────────────────────────────────────────┤
│ Ticket Scope Tabs                             │
├───────────────────────────────────────────────┤
│ Group Selection + Theme Toggle                │
├───────────────────────────────────────────────┤
│ Multi-Issue Tickets (Primary Work Area)       │
├───────────────────────────────────────────────┤
│ One-Issue Tickets (Secondary Work Area)       │
└───────────────────────────────────────────────┘
```

All sections are left-aligned, full-width, and share the same horizontal padding to ensure visual consistency.

---

## 1. Top Filter Bar

### Layout & Alignment
- Fixed height (e.g. 56px)
- Horizontal layout
- Filters aligned to the left
- Action buttons aligned to the right

```
[ Filter Controls ................................ ]   [ Apply ] [ Reset ]
```

### Colors
- Background: Light neutral gray (`#F5F6F8`)
- Apply button: Primary blue (`#2563EB`)
- Reset button: Neutral gray outline

### UX Rationale
- Keeps global filtering predictable
- Clear separation between configuration and action

---

## 2. Ticket Scope Tabs

### Tabs
- **My Tickets**
- **Group Tickets**

### Alignment
- Left-aligned below the filter bar
- Same horizontal padding as all other sections

### Colors
- Active tab: Blue underline (`#2563EB`)
- Inactive tab: Dark gray text
- Background: White

### UX Rationale
- Tabs affect both ticket sections consistently
- Underline style avoids visual clutter

---

## 3. Group Selection & Theme Toggle

### Layout
```
Assigned Group: [ OFC ▼ ] [ WOS ▼ ]            🌙 / ☀️
```

- Group selectors aligned left
- Theme toggle aligned right
- Balanced spacing across the row

### Colors
- Dropdowns: White background, gray border (`#E5E7EB`)
- Theme toggle:
  - Light mode: Sun icon with yellow accent
  - Dark mode: Moon icon with blue accent

---

## 4. Multi-Issue Tickets (Primary Section)

### Purpose
This section represents the primary work area. Tickets here require analysis and potential decomposition.

---

### Section Header
```
▼ Multi-Issue Tickets
─────────────────────
```

- Bold title
- Expand / collapse chevron
- Divider line for separation

### Colors
- Header text: Near-black (`#1F2933`)
- Accent divider: Muted amber (`#D97706`)

---

### Ticket Row Layout

Each ticket row uses a consistent four-column grid:

```
[ ☐ ] | [ INC0001 ] | [ Short description........ ] | [ Check ] [ Split ]
```

#### Column Behavior
1. Checkbox – fixed width
2. Ticket ID – fixed width, high contrast
3. Description – flexible, fills remaining space
4. Actions – right-aligned

---

### Actions

- **Check**
  - Neutral blue
  - Used for inspection and analysis

- **Split**
  - Muted amber / orange
  - Primary action for this section

Buttons are text-based with subtle outlines to reduce visual weight.

---

## 5. One-Issue Tickets (Secondary Section)

### Purpose
This section contains tickets with a single, clearly defined issue. These tickets are ready for execution.

---

### Section Header
```
▼ One-Issue Tickets
───────────────────
```

### Colors
- Header accent: Neutral gray (`#E5E7EB`)
- Lower visual emphasis than the primary section

---

### Ticket Row Layout

The grid remains consistent but without action buttons:

```
[ ☐ ] | [ INC0101 ] | [ Short description...................... ]
```

- No action column
- Description expands further to the right
- Minimal, calm presentation

---

## 6. Color Palette

### Core Colors
- Page background: `#F5F6F8`
- Content background: `#FFFFFF`
- Primary text: `#1F2933`
- Secondary text: `#6B7280`
- Borders: `#E5E7EB`

### Accent Colors
- Primary actions & tabs: `#2563EB`
- Multi-Issue accent / Split: `#D97706`

---

## 7. Dark Mode (Optional)

- Page background: `#111827`
- Content cards: `#1F2933`
- Text: `#E5E7EB`
- Accents: Same hue, reduced brightness

---

## Alignment & Consistency Checklist

- Consistent horizontal padding across all sections
- Uniform row height for all ticket rows
- Fixed column widths for checkboxes and ticket IDs
- Right-aligned actions
- Clear visual hierarchy between primary and secondary sections

---

## Summary

The Ticket Overview GUI is a grid-aligned, visually balanced interface that prioritizes complex ticket cleanup through the **Multi-Issue Tickets** section, while presenting **One-Issue Tickets** in a calm, execution-ready layout supported by a restrained, professional color palette.

