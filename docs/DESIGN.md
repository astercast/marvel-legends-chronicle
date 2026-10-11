# Design System — "The Archive" v2

Art direction: **museum-grade collector archive**. Deep ink blacks, archival
paper tones, one signature red used with discipline. Christie's lot catalog
meets Marvel — confident, tactile, never childish, never a template.

## Tokens (`assets/css/tokens.css`)

- **Ink & paper:** `--bg` gallery black → `--bg-deep` recess; `--panel` card
  ground → `--panel-3` hover raise. Text: `--ink` (archival paper white
  `#f5f1e8`), `--ink-dim`, `--muted` (all ≥ 4.5:1 on `--bg`).
- **Signature red `--red`:** brand seal, primary actions, active states,
  key rules ONLY. `--red-ink` for small text. Brass `--gold` = provenance,
  BAF, milestones.
- **Type:** `--font-display` (Archivo) for headings; `--font-cond`
  (Arial Narrow / HelveticaNeue-CondensedBold → Archivo fallback) for
  kickers, numerals, stat values, lot tags — the condensed voice of the
  archive. `--font-mono` for catalog data. No webfonts: fully self-contained.
- **Elevation:** `--edge-light` (1px inset top highlight) + `--shadow-1/2/3`
  on every raised surface = the "spotlit lot" feel.
- **Motion:** `--dur-1/2/3`, `--ease` / `--ease-swift`. All animation dies
  under `prefers-reduced-motion` (global kill-switch in `base.css`).

## Components

- **Figure cards** (`.figure-card`, timeline.css): tactile lot cards —
  edge-light top, red hairline reveals on hover, 3px lift, panel-2 ground.
- **Badges** (`.badge-*`): lot tags — condensed, wide-tracked uppercase.
- **Buttons:** decisive; primary = signature red, gold = brass actions.
- **Inputs:** deep recess ground, brass focus ring.
- **Modal:** archive drawer — red top rule, hairline-divided head.
- **Tables** (`.data-table`, `.value-table`, `.price-table`): tabular
  numerals everywhere, condensed wide-tracked headers, brass row hover.
- **Year heads:** gallery placards — condensed numerals, red rule accent.
- **Era bands:** brass placards with kicker labels.

## Rules for future work

1. New pages: use tokens + existing components only. No new colors.
2. Red appears at most once per viewport fold outside the masthead.
3. Every new interactive element: `:focus-visible` (free via base.css),
   keyboard operable, `prefers-reduced-motion` safe.
4. Print: `print.css` must keep working — never rename classes it targets
   (`.figure-card`, `.wave`, `.year-head`, `.check-*`, `.era-*`).
5. Performance: CSS stays dependency-free; page weight budget 500KB
   enforced by `scripts/validate.sh`.
