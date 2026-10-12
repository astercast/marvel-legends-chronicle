/* Wave 17: grading guide pure logic.
   The C-10 through C-1 collector condition scale, stated as standard hobby
   shorthand (10 = flawless, 1 = poor). It is a rule of thumb collectors use
   when describing listings — not an official standard and not a valuation.
   Each grade carries a separate carded (MOC) and loose meaning, because a
   scuffed blister and a scuffed elbow are different problems. */

export const GRADES = [
  { code: "C-10", label: "Mint", carded: "Card flat and flawless, sharp corners, bubble crystal-clear and unblemished, no yellowing, no price stickers or sticker residue.", loose: "Flawless figure: crisp paint apps, tight joints, complete with every accessory, BAF piece, and insert/paperwork." },
  { code: "C-9", label: "Near mint", carded: "A single trivial flaw a buyer might miss on first glance: one soft corner, faint blister scuff, or a lightly toned edge.", loose: "Essentially mint: paint and joints perfect, complete; at most one barely visible paint dot or a joint that is merely a hair loose." },
  { code: "C-8", label: "Excellent", carded: "Light wear in one or two spots: minor corner wear, light blister scuffing, slight toning. Still displayable from the front.", loose: "Minor wear: small paint rub at one or two joints, or one accessory missing (a BAF piece still missing drops it further)." },
  { code: "C-7", label: "Very good", carded: "Noticeable wear: multiple worn corners, visible blister scuffs, mild yellowing, or a removed price sticker with faint residue.", loose: "Lightly played with: a few paint rubs, joints slightly loose but still posing, complete except for one small accessory." },
  { code: "C-6", label: "Good", carded: "Clear shelf wear: creased card, bent corner, hazed or yellowing bubble, or a small crack in the blister that still holds the figure.", loose: "Played with but solid: visible paint wear on joint surfaces, noticeably loose joints that still hold a pose, missing one or two accessories." },
  { code: "C-5", label: "Fair", carded: "Heavy wear: flattened corners, deep creases, heavily yellowed or cracked bubble — figure visible but package rough.", loose: "Well-loved: floppy joints, widespread paint wear, missing accessories or its BAF piece; still one complete displayable figure." },
  { code: "C-4", label: "Below average", carded: "Card bent or torn, blister separating from card, or heavy yellowing that obscures the figure.", loose: "Joints barely holding, paint worn to bare plastic in spots, several accessories missing; a customizer or placeholder copy." },
  { code: "C-3", label: "Poor", carded: "Card crushed, torn, or water-damaged; blister open or detached.", loose: "Broken or repaired: glued joints, replaced parts, stress marks — sold for parts or as a placeholder." },
  { code: "C-2", label: "Incomplete", carded: "Opened/resealed packaging kept as a container only; card damage secondary to the opened state.", loose: "Major parts missing: limbs, BAF torso, or head. Bought for the surviving parts or as a body for customs." },
  { code: "C-1", label: "Junk", carded: "Packaging destroyed or discarded; carded format no longer applies.", loose: "Figure destroyed: multiple breaks, melted plastic, stripped paint. Parts-bin fodder only." },
];

/* Collector shorthand bands for the scale. Returns null for anything
   outside the C-10..C-1 range. */
export function gradeBand(code) {
  const m = /^C-(10|[1-9])$/.exec(String(code).trim().toUpperCase());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (n >= 9) return "mint band";
  if (n === 8) return "near mint";
  if (n >= 6) return "player/collector";
  if (n >= 4) return "well loved";
  return "parts only";
}

/* Render the scale as table rows for grading.html. HTML-escapes all data. */
export function renderGradeRows() {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  return GRADES.map((g) => [
    "<tr>",
    `<th scope="row">${esc(g.code)}<span class="grade-label">${esc(g.label)}</span></th>`,
    `<td>${esc(g.carded)}</td>`,
    `<td>${esc(g.loose)}</td>`,
    `<td>${esc(gradeBand(g.code))}</td>`,
    "</tr>",
  ].join("")).join("\n");
}

/* Browser wiring: fills the scale table on grading.html. No-op elsewhere. */
export function initGrading() {
  if (typeof document === "undefined") return;
  const body = document.getElementById("grade-scale-body");
  if (!body) return;
  body.innerHTML = renderGradeRows();
}

initGrading();
