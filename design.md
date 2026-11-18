# Sweety interface design

## Product and direction

Sweety is a personal blood glucose log. This first screen helps someone record up to four readings per day and review their data at a glance. The visual direction takes cues from Apple’s health-data guidance: calm surfaces, direct labels, restrained decoration, and clear context around sensitive measurements. It is an original web interface; it does not use Apple Health branding, screenshots, or controls.

## Principles

- **Make the data easy to read.** Give the selected date, time slot, unit, and report range clear labels. Use tabular numerals for measurements.
- **Keep the tone calm and nonjudgmental.** Present recorded values without implying that a value is good, bad, or a diagnosis. Do not add target bands unless a clinician-configured target is part of the product.
- **Use charts to explain, not decorate.** The daily view uses a smooth line chart with time slots on the horizontal axis. Plot only recorded readings and reveal an exact value card on hover or keyboard focus.
- **Respect health-data privacy.** Ask for access only when a feature needs it, explain the purpose in context, and never imply an Apple Health connection unless one is implemented. Explain what happens to data before collecting or sharing it.
- **Keep the product personal.** Use one tracker navigation model. Do not imply team workspaces or shared patient records. Show the signed-in person clearly, using their actual profile image when available.

## Visual system

### Color

- App background: `#F5F5F7`, a cool, quiet neutral.
- Main surface: `#FFFFFF`.
- Primary text: `#1D1D1F`.
- Secondary text: `#6E6E73`.
- Divider and plot grid: `#E5E5EA`.
- Sweety glucose accent: `#E66B5B`, reserved for the primary action and plotted readings.
- Accent tint: `#FCEDEA`, for subtle active states and chart emphasis.
- Use semantic caution colors only with a clear text label. Never rely on color alone.

### Typography

- Use the system sans-serif stack (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif) for a familiar, crisp interface.
- Page title: 30–34 px, semibold. Card title: 16–18 px, semibold. Body: 14–16 px. Supporting labels: 12–13 px.
- Use sentence case, short labels, and tabular numerals for mg/dL values.

### Layout and surfaces

- Use a centered desktop content column with a compact top bar. On phones, keep the same hierarchy and stack cards in reading order.
- Use a 4 px spacing base, 16–22 px card padding, and consistent alignment.
- Cards have a white surface, 14–18 px corner radius, a fine neutral border, and minimal shadow. Avoid nested cards and decorative rings.
- Use a compact segmented control for Daily, Month to date, and Last month reports.
- Use a single coral primary button for “Log a reading”; secondary actions stay quiet and neutral.
- Show the four daily slots in order: Morning (fasting), After breakfast, After lunch, After dinner. Distinguish saved readings from open slots with labels as well as appearance.

## Chart and reports

- The chart stays a single smooth line across Daily, Month to date, and Last month ranges. Use four distinct, consistently assigned colors for Morning, After breakfast, After lunch, and After dinner; color each segment by the slot it leads to and place the matching legend above the plot.
- Connect two actual points only when they belong to adjacent time slots. Leave a gap when a slot is missing; never interpolate or imply a measurement that was not recorded.
- Label the vertical scale with subtle numeric mg/dL values and the horizontal scale with the four time slots in Daily view or date ticks in longer ranges. Use a few very light dashed horizontal scale lines at all times; avoid static point values and extra series.
- Hovering anywhere in the plot selects the nearest recorded time slot. On hover, tap, or keyboard focus, show a compact floating white card beside that point with the date, slot name, matching color key, and exact mg/dL value. Keep the card inside the chart card and ensure it does not obscure the point unnecessarily. Use colors as identifiers, not as judgments about a value.
- Daily, month-to-date, and previous-month reports each show highest, lowest, average rounded to one decimal, and reading count. An empty report says there are no readings in that range and offers a clear next step.

## Interaction and accessibility

- The log form asks for date, time slot, and a whole-number value in mg/dL. Show inline errors for missing values, values outside 40–600, duplicate daily slots, more than four readings per date, and future dates.
- Use semantic headings and controls, visible labels, keyboard operation, and a clear focus indicator. Keep text and controls at WCAG AA contrast.
- Respect reduced-motion preferences. Transitions should be brief and should never carry essential information.
- Use a real profile portrait when available; allow the account holder to replace it. A stock portrait used in this prototype is temporary artwork, not an authenticated user identity.

## Voice

Clear, kind, and factual. Say “Log a reading” or “No readings for this date range yet.” Avoid alarmist copy, treatment advice, promises about privacy that the implementation has not earned, and claims that the app interprets medical results.

## Reference

Apple, [HealthKit Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/healthkit), especially the guidance on requesting health-data access in context, explaining data use, and reserving Activity rings for Move, Exercise, and Stand progress.
