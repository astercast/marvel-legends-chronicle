# Accessibility audit — Marvel Legends Chronicle

Date: 2026-10-11. Method: static audit of all interactive pages + CSS,
keyboard-walk of the dialog/modal/wizard/showcase flows in code.

## Verdict

No blocking issues. One real gap found and fixed (see §2). The rest is
verified good practice, documented here so it stays that way.

## 1. Fixed in this pass

- **`explore.html` — `#surprise-progress` was not announced.**
  The "N of 1,939 discovered" counter updates on every "Surprise me" draw but
  had no live region, so screen-reader users got no feedback. Added
  `aria-live="polite"`. (One-line change; no visual difference.)

## 2. Verified good

### Keyboard
- Every interactive control is a real `<button>`, `<a>`, `<input>`,
  `<select>`, or `<textarea>` — no div-click handlers anywhere
  (`grep` over `assets/js/` confirms).
- **Showcase reorder:** drag-and-drop is a progressive enhancement; Up/Down
  buttons provide the full keyboard path (`showcase.js` `moveId`).
- **Shelf gallery reorder (Wave 21):** every photo carries ← / → buttons
  (aria-labeled "Move photo earlier/later"), and a focused photo responds to
  Left/Right arrow keys with focus restored to the moved photo
  (`gallery.js`). No drag-only path anywhere.
- **Modal (`assets/js/modal.js`):** full focus trap (Tab cycles inside),
  Escape closes, focus returns to the invoking element, focus moves to the
  close button on open, `role="dialog"` + `aria-modal="true"` +
  `aria-labelledby`.
- **Auth wizard:** step changes move focus to the step heading
  (`tabindex="-1"` + `.focus()`); the results card does the same.
- **BAF planner / tracker toggles:** `aria-pressed` reflects state;
  `aria-current` marks the selected BAF.

### Dynamic content announcements
`aria-live="polite"` is present on every dynamically-updated region audited:
wizard, BAF detail, econ stats, checklist summary + list, ledger KPIs,
community main, exclusives coverage, hunt results, surprise progress (fixed
this pass), showcase quest-strip (level / achievements / rarest owned) and
shelfie copy status (`gallery.js`), and 6 more pages.

### Forms
All inputs on `gift.html`, `journal.html`, `hunt.html`, `watchlist.html`,
`checklist.html`, `compare.html` have `<label>`s or `aria-label`s — zero
unlabeled controls found.

### Focus visibility
`:focus-visible` styles in `base.css`; `.skip-link` present on every root
page (skip to main content).

### Motion
`@media (prefers-reduced-motion: reduce)` in `base.css` and
`components.css`; `showcase.html` carries a scoped reduce block for the
gallery (Wave 21); no auto-playing animation anywhere (sparklines and charts
are static SVG).

### Color contrast (measured 2026-10-11, WCAG AA = 4.5:1)

| Text | On bg `#0b0b10` | On panel `#15151f` |
|---|---|---|
| `--ink` `#f4f4f7` | 17.9:1 ✓ | 16.5:1 ✓ |
| `--ink-dim` `#b9b9c7` | 10.1:1 ✓ | 9.3:1 ✓ |
| `--muted` `#8a8a9c` | 5.8:1 ✓ | 5.3:1 ✓ |
| `--gold` `#f5b301` | 10.6:1 ✓ | 9.8:1 ✓ |
| `--blue` `#7fd4ff` | 11.9:1 ✓ | 11.0:1 ✓ |
| `--green` `#5dff8f` | 15.1:1 ✓ | 13.9:1 ✓ |

### Charts
The stats bar chart and price-trend sparklines are `role="img"` SVG with
`<title>` descriptions plus adjacent data tables / text summaries — no
information is chart-only.

## 3. Known non-issues (don't "fix")

- `modal.js` focus-trap visibility check uses `el.offsetParent !== null`.
  Correct here: the dialog is never `position: fixed` on the focusable
  elements themselves.
- `explore.html` curated grids render up to ~200 cards; they are plain
  articles in document order — verbose but navigable. Virtualization would
  harm simplicity for no measured need.

## 4. Keeping it accessible

- New dynamic regions: add `aria-live="polite"`.
- New dialogs: use `openModal()` from `assets/js/modal.js` — never roll
  your own.
- New charts: `role="img"` + `<title>` + a text/table equivalent.
- New pages: keep the skip link and `#main` landmark from any existing page.
