/* gallery-core.js, pure Shelf Gallery logic (Wave 21: Showcase 2.0).
   No DOM, no storage, no init: safe to import from the showcase page and
   from Node tests. All figure references are validated against the caller's
   archive map, nothing is invented.

   State shape (persisted as mlc_gallery_v1):
     { shelves: [ { id, name, layout, photos: [
         { id, dataUrl, caption, tags: [figId], ts } ] } ] }
   Photos live entirely client-side as dataURLs; nothing is ever uploaded. */

import { isChase, isConventionExclusive, isVariant, costTier } from "./quest-core.js";
import { buildQuestShareText } from "./quest-share.js";

/* ------------------------------------------------------------------ */
/* Layout templates                                                    */

export const LAYOUTS = [
  { id: "grid", name: "Grid", blurb: "Even rows, the classic cabinet look." },
  { id: "run", name: "Character-run row", blurb: "One long row per character or series run." },
  { id: "baf", name: "BAF centerpiece", blurb: "A hero shot in the middle, the build crew around it." },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

/* ------------------------------------------------------------------ */
/* Photo encoding presets + storage budget                              */
/* Canvas re-encoding strips EXIF on import (see gallery.js).          */

export const FULL_PRESET = { maxDim: 1200, quality: 0.82, mime: "image/jpeg" };
export const DOWNSCALE_PRESET = { maxDim: 800, quality: 0.7, mime: "image/jpeg" };

/* Soft budget for all gallery dataURL text, in characters (~bytes for
   base64 ASCII). Kept below the typical ~5MB localStorage quota so the
   "storage full" path is graceful instead of a surprise. */
export const STORAGE_SOFT_CAP = 4000000;

export const MAX_CAPTION = 140;
export const MAX_TAGS_PER_PHOTO = 6;
export const MAX_SHELF_NAME = 60;

/* ------------------------------------------------------------------ */

export function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(36)}`;
}

export function defaultShelves() {
  return {
    shelves: [
      { id: makeId("shelf"), name: "Top shelf", layout: "grid", photos: [] },
      { id: makeId("shelf"), name: "BAF row", layout: "baf", photos: [] },
    ],
  };
}

export function findShelf(state, shelfId) {
  return (state.shelves ?? []).find((s) => s.id === shelfId) ?? null;
}

function clone(state) {
  return JSON.parse(JSON.stringify(state));
}

/* ------------------------------------------------------------------ */
/* Shelf operations (immutable, return a new state)                    */

export function addShelf(state, name) {
  const next = clone(state);
  const clean = String(name ?? "").trim().slice(0, MAX_SHELF_NAME) || "New shelf";
  next.shelves.push({ id: makeId("shelf"), name: clean, layout: "grid", photos: [] });
  return next;
}

export function renameShelf(state, shelfId, name) {
  const next = clone(state);
  const shelf = findShelf(next, shelfId);
  const clean = String(name ?? "").trim().slice(0, MAX_SHELF_NAME);
  if (shelf && clean) shelf.name = clean;
  return next;
}

export function removeShelf(state, shelfId) {
  const next = clone(state);
  next.shelves = next.shelves.filter((s) => s.id !== shelfId);
  return next;
}

export function setLayout(state, shelfId, layoutId) {
  const next = clone(state);
  const shelf = findShelf(next, shelfId);
  if (shelf && LAYOUTS.some((l) => l.id === layoutId)) shelf.layout = layoutId;
  return next;
}

/* ------------------------------------------------------------------ */
/* Photo operations (immutable, return a new state)                    */

export function addPhoto(state, shelfId, { dataUrl, caption = "", tags = [], ts = Date.now() }) {
  const next = clone(state);
  const shelf = findShelf(next, shelfId);
  if (!shelf || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) return state;
  shelf.photos.push({
    id: makeId("photo"),
    dataUrl,
    caption: String(caption).slice(0, MAX_CAPTION),
    tags: Array.isArray(tags) ? [...new Set(tags)].slice(0, MAX_TAGS_PER_PHOTO) : [],
    ts: Number(ts) || Date.now(),
  });
  return next;
}

export function removePhoto(state, shelfId, photoId) {
  const next = clone(state);
  const shelf = findShelf(next, shelfId);
  if (shelf) shelf.photos = shelf.photos.filter((p) => p.id !== photoId);
  return next;
}

/* Move a photo one step within its shelf (dir = -1 | 1). Same swap
   semantics as the showcase's moveId, tested. */
export function movePhoto(state, shelfId, photoId, dir) {
  const next = clone(state);
  const shelf = findShelf(next, shelfId);
  if (!shelf) return state;
  const i = shelf.photos.findIndex((p) => p.id === photoId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= shelf.photos.length) return state;
  [shelf.photos[i], shelf.photos[j]] = [shelf.photos[j], shelf.photos[i]];
  return next;
}

export function updatePhoto(state, shelfId, photoId, patch) {
  const next = clone(state);
  const shelf = findShelf(next, shelfId);
  const photo = shelf?.photos.find((p) => p.id === photoId);
  if (!photo) return state;
  if (patch.caption !== undefined) photo.caption = String(patch.caption).slice(0, MAX_CAPTION);
  return next;
}

/* Tag a photo with archive figure ids. Unknown ids are dropped, dupes
   collapse, capped at MAX_TAGS_PER_PHOTO. validIds: Set of real ids. */
export function setPhotoTags(state, shelfId, photoId, tags, validIds) {
  const next = clone(state);
  const shelf = findShelf(next, shelfId);
  const photo = shelf?.photos.find((p) => p.id === photoId);
  if (!photo) return state;
  const seen = new Set();
  photo.tags = [];
  for (const t of Array.isArray(tags) ? tags : []) {
    if (photo.tags.length >= MAX_TAGS_PER_PHOTO) break;
    if (validIds.has(t) && !seen.has(t)) { seen.add(t); photo.tags.push(t); }
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* Sanitizer, repairs shape drift (bad layout, unknown tags) on load.  */

export function sanitizeGallery(state, validIds) {
  const raw = state && Array.isArray(state.shelves) ? state : { shelves: [] };
  const shelves = raw.shelves
    .filter((s) => s && typeof s.id === "string")
    .map((s) => ({
      id: s.id,
      name: String(s.name ?? "Shelf").slice(0, MAX_SHELF_NAME) || "Shelf",
      layout: LAYOUTS.some((l) => l.id === s.layout) ? s.layout : "grid",
      photos: (Array.isArray(s.photos) ? s.photos : [])
        .filter((p) => p && typeof p.id === "string" && typeof p.dataUrl === "string"
          && p.dataUrl.startsWith("data:image/"))
        .map((p) => ({
          id: p.id,
          dataUrl: p.dataUrl,
          caption: String(p.caption ?? "").slice(0, MAX_CAPTION),
          tags: (Array.isArray(p.tags) ? p.tags : []).filter((t) => validIds.has(t))
            .slice(0, MAX_TAGS_PER_PHOTO),
          ts: Number(p.ts) || 0,
        })),
    }));
  return { shelves };
}

/* ------------------------------------------------------------------ */
/* Storage budget                                                      */

export function photoTotalBytes(state) {
  let total = 0;
  for (const s of state.shelves ?? []) {
    for (const p of s.photos ?? []) total += (p.dataUrl ?? "").length;
  }
  return total;
}

export function storageStatus(totalBytes) {
  if (totalBytes >= STORAGE_SOFT_CAP) return "full";
  if (totalBytes >= STORAGE_SOFT_CAP * 0.75) return "near";
  return "ok";
}

/* ------------------------------------------------------------------ */
/* Archive-signal rarity: which owned figure is the "rarest owned"?     */
/* Same signals as quest-core achievements, nothing invented.         */

export function rarityScore(fig) {
  if (!fig) return 0;
  let s = 0;
  if (isChase(fig)) s += 4;
  if (isConventionExclusive(fig)) s += 3;
  if (costTier(fig) === 4) s += 3; // HasLab / made-to-order
  if (isVariant(fig)) s += 2;
  return s;
}

/* Returns the owned figure with the highest rarity score, or null when
   nothing owned clears score > 0. Tie-break: newer year, then name. */
export function rarestOwned(figures, ownedIds) {
  const ownedSet = new Set(ownedIds);
  let best = null, bestScore = 0;
  for (const f of figures) {
    if (!ownedSet.has(f.id)) continue;
    const s = rarityScore(f);
    if (s > bestScore
      || (s === bestScore && best && (f.year > best.year
        || (f.year === best.year && f.name < best.name)))) {
      best = f; bestScore = s;
    }
  }
  return best;
}

/* Newest photo whose tags include a rarity-scored figure, the
   "latest grail-worthy shelfie" for the share card. */
export function latestGrailShelfie(state, byId) {
  let best = null;
  for (const s of state.shelves ?? []) {
    for (const p of s.photos ?? []) {
      for (const t of p.tags ?? []) {
        const fig = byId.get(t);
        if (fig && rarityScore(fig) > 0 && (!best || p.ts > best.photo.ts)) {
          best = { photo: p, fig };
        }
      }
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Gallery stats (for the share card)                                   */

export function galleryStats(state, byId) {
  const shelves = (state.shelves ?? []).length;
  let photos = 0, tagged = 0;
  const counts = new Map();
  for (const s of state.shelves ?? []) {
    for (const p of s.photos ?? []) {
      photos++;
      const valid = (p.tags ?? []).filter((t) => byId.has(t));
      if (valid.length) tagged++;
      for (const t of valid) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  const topFigures = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || String(byId.get(a[0])?.name ?? "").localeCompare(byId.get(b[0])?.name ?? ""))
    .slice(0, 5)
    .map(([id, count]) => ({ id, count, name: byId.get(id)?.name ?? id }));
  return { shelves, photos, tagged, uniqueFigures: counts.size, topFigures };
}

/* ------------------------------------------------------------------ */
/* "Shelfie" share card, gallery lines + the shared quest card.        */
/* quest: { level, ownedCount, archiveCount, completedBafs,             */
/*          achievements, latestAchievement }, same inputs as          */
/* buildQuestShareText, which supplies the quest section verbatim.      */

export function buildShelfieCard({ gallery, byId, quest }) {
  const stats = galleryStats(gallery, byId);
  const lines = [];
  lines.push(`📸 My Legends Shelfie, ${stats.photos} photo${stats.photos === 1 ? "" : "s"}`
    + ` across ${stats.shelves} shel${stats.shelves === 1 ? "f" : "ves"}`);
  if (stats.topFigures.length) {
    lines.push(`🖼️ Top tagged: ${stats.topFigures.map((t) => `${t.name} ×${t.count}`).join(", ")}`);
  } else if (stats.photos > 0) {
    lines.push("🖼️ Tag your photos with archive figures to name your shelf stars.");
  } else {
    lines.push("🖼️ No shelfie photos yet, add your first.");
  }

  lines.push("");
  lines.push(buildQuestShareText({
    level: quest.level,
    ownedCount: quest.ownedCount,
    archiveCount: quest.archiveCount,
    completedBafs: quest.completedBafs,
    achievements: quest.achievements,
    quests: [],
    latestAchievement: quest.latestAchievement,
    recs: null,
  }));

  const grail = latestGrailShelfie(gallery, byId);
  if (grail) {
    const { photo, fig } = grail;
    const cap = photo.caption ? `, “${photo.caption}”` : "";
    lines.push(`👑 Latest grail-worthy shelfie: ${fig.name}, ${fig.waveSeries} (${fig.year})${cap}`);
  }
  return lines.join("\n");
}
