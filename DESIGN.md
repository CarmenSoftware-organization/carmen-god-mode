---
name: Carmen God Mode
description: Direct admin console over the live Carmen inventory database, a sibling of carmen-backstage with loud safety signals.
colors:
  fired-terracotta: "oklch(0.5800 0.1720 36.4421)"
  on-primary: "oklch(1.0000 0 0)"
  alarm-red: "oklch(0.6368 0.2078 25.3313)"
  cool-mist: "oklch(0.9383 0.0042 236.4993)"
  paper-white: "oklch(1.0000 0 0)"
  graphite: "oklch(0.3211 0 0)"
  slate-muted: "oklch(0.5510 0.0234 264.3637)"
  hairline: "oklch(0.9022 0.0052 247.8822)"
  quiet-fill: "oklch(0.9846 0.0017 247.8389)"
  hover-fill: "oklch(0.9670 0.0029 264.5419)"
  rail-gray: "oklch(0.9030 0.0046 258.3257)"
  rail-active: "oklch(0.9119 0.0222 243.8174)"
  rail-active-ink: "oklch(0.3791 0.1378 265.5222)"
  caution-amber: "hsl(38 92% 45%)"
  clear-green: "hsl(142 40% 40%)"
  signal-blue: "hsl(221 61% 48%)"
typography:
  headline:
    fontFamily: "Inter, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "0.05em"
  data:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  cell-x: "12px"
  cell-y: "8px"
  card-x: "16px"
  card-y: "12px"
  page-x: "32px"
  page-y: "24px"
components:
  button-primary:
    backgroundColor: "{colors.fired-terracotta}"
    textColor: "{colors.on-primary}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-danger:
    backgroundColor: "{colors.alarm-red}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.hover-fill}"
  button-ghost:
    textColor: "{colors.slate-muted}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  input:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.graphite}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "36px"
  badge-neutral:
    backgroundColor: "{colors.quiet-fill}"
    textColor: "{colors.slate-muted}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  card:
    backgroundColor: "{colors.paper-white}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  nav-item-active:
    backgroundColor: "{colors.rail-active}"
    textColor: "{colors.rail-active-ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  target-bar-live:
    backgroundColor: "{colors.alarm-red}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    height: "32px"
    padding: "0 24px"
---

# Design System: Carmen God Mode

## Overview

**Creative North Star: "The Control Room"**

God Mode is a control room for the live Carmen database. The operator always
knows which system they are connected to, reads dense data quickly, and acts
through controls that have weight. Most of the room is calm and familiar. Its
cool-gray surfaces, Inter type, sidebar rail and zebra tables come from
carmen-backstage, so someone who works in both tools feels at home. The
deviations exist only where a mistake would be permanent.

Two places deliberately break that family resemblance. One is the **live-target
bar**, a strip pinned above every page that names the target database and turns
alarm-red whenever the target is not local. The other is the **confirm
ceremony**: you type a phrase to arm the control, then press and hold to fire
it. All of the system's distinctiveness goes into these two elements and
nowhere else. The terracotta primary carries routine action. Red is reserved
for danger and never decorates.

Interactions are tactile and deliberate. Buttons drop 1px when pressed. The
seal control fills with ink from left to right while held. Pages settle in with
a 4px rise. Motion always reports state and is never ornament, and all of it
respects `prefers-reduced-motion`. The layout targets desktop only; the mobile
drawer exists as a fallback and is not a designed experience.

**Key Characteristics:**
- Cool-gray canvas, white working surfaces and hairline borders, with
  near-flat depth.
- One warm accent (Fired Terracotta) for routine action. Red means only "this
  is dangerous".
- Dense, scannable data: 14px body, 12px uppercase column heads, and
  JetBrains Mono for IDs, hosts, timestamps and SQL.
- The live-target bar is always visible. The confirm ceremony protects every
  irreversible write.
- Light and dark themes are both first-class, switched by a `.dark` class on
  `<html>`.

## Colors

The palette is a cool, low-chroma neutral field with one warm accent and a
separate alarm red. The values are shadcn's warm oklch theme. An adapter layer
in `app/globals.css` maps them onto god-mode's own token names (`surface`,
`accent`, `danger`, `seal`, …), and that adapter layer is the source of truth.

### Primary
- **Fired Terracotta** (`--primary`, consumed as `--accent` / `--link`):
  primary buttons, links, the focus ring and the sidebar ring. It is reserved
  for the one main action in a view. The same value is used in both themes, but
  links on dark surfaces switch to a lighter terracotta (`--link` in `.dark`)
  so they keep AA contrast.

### Secondary
- **Alarm Red** (`--destructive`, consumed as `--danger` / `--seal`): the live
  target bar, the "God Mode" badge next to the wordmark, danger buttons and the
  seal-confirm fill. Its pale form (`--danger-subtle`) backs danger alerts and
  badges.

### Neutral
- **Cool Mist** (`--background`): the page canvas behind everything.
- **Paper White** (`--card` → `--surface`): cards, inputs, table bodies and
  outline buttons, the surfaces where work happens.
- **Graphite** (`--foreground`): body text and titles.
- **Slate Muted** (`--muted-foreground`): secondary text, column heads,
  eyebrow labels, ghost buttons and placeholders.
- **Hairline** (`--border`): every divider and container edge. `--border-strong`
  is Hairline mixed with 18% foreground and is used for input hover.
- **Quiet Fill** / **Hover Fill** (`--muted` / `--secondary`): the neutral
  badge background, inline `code` chips, row and button hover.
- **Rail Gray**, **Rail Active**, **Rail Active Ink** (`--sidebar*`): the
  sidebar rail and its active nav row.

### State families
**Caution Amber**, **Clear Green** and **Signal Blue** are not part of the
shadcn theme. They are kept as god-mode's own AA-tuned HSL families, each in
four tiers (solid, `-subtle`, `-subtle-foreground`, `-border`) with separate
dark-theme values. Amber is for warnings and soft-delete, green for success and
restore, blue for informational alerts.

### Named Rules
**The Red Means Danger Rule.** Alarm red appears only where a write is
irreversible or the target is live. It is never used for emphasis, branding or
decoration.

**The One Warm Voice Rule.** Fired Terracotta is the only saturated hue in
routine UI. Each view gets one primary button. Everything else is outline or
ghost.

**The Never Colour Alone Rule.** Every status pairs its colour with an icon and
words. The target bar has a triangle icon plus "Every write is permanent", and
each alert has its own lucide icon.

## Typography

**Body / Display Font:** Inter (via `next/font`, weights 400–700, with
sans-serif fallback)
**Data Font:** JetBrains Mono (weights 400–600, with ui-monospace fallback)

**Character:** Inter carries the whole interface in a neutral, compact voice
shared with carmen-backstage. JetBrains Mono marks everything that is literal
machine data, so an operator can tell a schema name or host from prose at a
glance.

### Hierarchy
- **Headline** (600, 1.5rem, tracking-tight): page titles in `PageHeader`.
  There is one per page.
- **Title** (600, 0.875rem): card titles, alert titles and the face of
  primary buttons (500).
- **Body** (400, 0.875rem, line-height 1.5): the default for tables, forms and
  ledes. Ledes are capped at `max-w-prose`.
- **Label** (600, 0.75rem, uppercase, tracking-wider): page eyebrows (the
  `rubric`), `SectionLabel`, column heads (at weight 500) and the target-bar
  label.
- **Data** (mono 400, 0.75rem): IDs, hosts, timestamps, byte sizes, SQL and
  confirm phrases inside `code` chips.

### Named Rules
**The Mono Is Literal Rule.** Mono type is used only for values the system
reads exactly (identifiers, phrases to type, SQL). It is never used for
emphasis.

## Layout

The app shell is a fixed-height frame. A 240px sidebar rail, which collapses to
64px with a 300ms width transition, sits beside the content column. The column
has the 32px live-target bar on top and a scrolling `main` below, padded 24px
vertically and 32px horizontally (16px below `md`). Content is fluid and fills
the width; there is no centered max-width container, because tables need the
room.

Rhythm is compact and consistent:
- table cells use 12px × 8px padding;
- card headers, bodies and footers use 16px × 12px;
- page headers end with a hairline rule and 24px of space below.

The layout is designed for desktop. Below `md`, the rail becomes a hamburger
drawer as a fallback only.

## Elevation & Depth

The system is close to flat. Depth comes from tonal layering: Paper White
surfaces on the Cool Mist canvas, separated by Hairline borders. Shadows are
limited to a whisper (`shadow-sm`) under solid buttons, so they read as
pressable. Cards carry a border and no shadow.

### Shadow Vocabulary
- **Button lift** (`box-shadow: 0px 1px 3px 0px hsl(0 0% 0% / 0.10), 0px 1px 2px -1px hsl(0 0% 0% / 0.10)`):
  used on primary, danger, warning and success buttons only.

### Named Rules
**The Border Before Shadow Rule.** A new container separates itself with a
Hairline border and a surface tone, never with a shadow.

## Shapes

Corners are gently rounded on a single scale derived from a 12px base radius:
- inputs, buttons and nav rows use 10px;
- cards use 12px;
- alerts use 10px;
- badges are fully rounded pills;
- the small "God Mode" badge and inline code chips are 4px.

All borders are 1px Hairline. The only clipping is inside the seal-confirm
button, where the ink fill is clipped to the button's rounded shape.

## Components

### Buttons
Buttons are tactile and deliberate. Every press drops 1px.
- **Shape:** gently rounded (10px). Heights are 32px for `sm` (12px text),
  36px for `md` (the default) and 40px for `lg`.
- **Primary:** Fired Terracotta fill with white 14px/500 text and the button
  lift. Hover darkens it 12% via `color-mix`.
- **Danger:** Alarm Red fill. Hover darkens it 10%.
- **Outline:** Paper White with a Hairline border. Hover moves to Hover Fill.
- **Ghost / Danger-ghost:** text only (Slate Muted or red) with a fill on
  hover.
- **Warning / Success:** amber or green fills for soft-delete and restore.
- **Focus:** a 2px ring outline with a 2px offset. Disabled buttons drop to 50%
  opacity, and `pending` sets `aria-busy`.

### Badges
- **Style:** a pill with a 1px border in the state family's `-border` tone, a
  `-subtle` fill and `-subtle-foreground` text at 12px/500.
- **Variants:** neutral, info, success, warning and danger. Examples are the
  danger "Deleted" marker in the business-unit table.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Paper White.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px Hairline, plus Hairline rules between header, body and
  footer.
- **Internal Padding:** 16px × 12px.

### Inputs / Fields
- **Style:** 36px tall, Paper White, 1px Hairline border, 10px corners, 14px
  text with Slate Muted placeholders.
- **Hover:** the border strengthens to `--border-strong`.
- **Focus:** a 2px ring outline with the border going transparent.
- **Disabled:** 50% opacity and a not-allowed cursor.

### Tables
- **Style:** full width with horizontal overflow. Column heads are 12px/500
  uppercase Slate Muted. Cells are truncated at `max-w-xs`.
- **Zebra:** even rows tint with 3% foreground (4% in dark). Hover moves to
  Hover Fill with a 150ms transition.
- **Sorting:** a sortable column head (`SortableTh`) toggles direction on
  click.

### Navigation
- **Style:** a Rail Gray sidebar with the "CARMEN" wordmark (bold, tracking
  tight) and a red "God Mode" pill. Nav rows are 14px/500 with a 16px lucide
  icon.
- **States:** rows default to Slate Muted. Hover and active use Rail Active
  with Rail Active Ink text, and the active row sets `aria-current="page"`.
- **Footer:** the theme toggle and Log out, as ghost rows.

### Live-Target Bar (signature)
- A 32px strip above all content, with `role="status"`.
- **Local:** Quiet Fill with Slate Muted text. The label is uppercase, and the
  host is in mono.
- **Live:** an Alarm Red fill with white text, a triangle-alert icon, and the
  right-aligned "Every write is permanent".
- It is the system's first loud element and cannot be dismissed.

### Seal Confirm (signature)
- The ceremony that replaces a plain destructive submit button.
- Step 1: type the exact phrase, shown in a mono `code` chip, to arm the
  control.
- Step 2: press and hold the 44px full-width button. A red ink fill grows from
  left to right over 700ms (linear), and releasing early snaps it back in
  140ms.
- The face text is 14px/500 uppercase with 0.12em tracking. It reads in turn
  "Type the phrase to arm", "Press & hold to confirm", "Confirming…" and
  "Confirmed".
- Space or Enter hold works the same from the keyboard.

### Alerts
- Rounded (10px) and bordered, using a state family (`-subtle` fill,
  `-border`, `-subtle-foreground` text).
- Each carries a 20px lucide icon, a semibold title and an optional body.
- Danger alerts use `role="alert"`. All other variants use `role="status"`.

## Do's and Don'ts

### Do:
- **Do** consume god-mode token names (`bg-surface`, `text-foreground-muted`,
  `bg-accent`, `bg-danger`). Re-skinning happens in the adapter layer of
  `app/globals.css`, not in components.
- **Do** route every irreversible write through the Seal Confirm ceremony,
  with a blast-radius preview before it.
- **Do** keep the live-target bar on every authenticated page.
- **Do** set identifiers, hosts, SQL and confirm phrases in JetBrains Mono.
- **Do** check both light and dark themes. Every new token needs a `.dark`
  value or must derive through `var()` / `color-mix()`.
- **Do** keep motion functional: the 1px press, the 220ms page-in, the 150ms
  row hover, the 700ms hold fill. All of it is gated by
  `prefers-reduced-motion`.

### Don't:
- **Don't** use alarm red or the danger fill for anything that isn't
  destructive or live.
- **Don't** add a second loud, god-mode-specific element. The target bar and
  the confirm ceremony are the only places where the system departs from
  carmen-backstage.
- **Don't** convey status by colour alone. Pair it with an icon and text.
- **Don't** add shadows to cards or containers. Use a Hairline border and
  surface tone.
- **Don't** reintroduce the retired Ledger identity (aged paper, serif display,
  wax seal).
