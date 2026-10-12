/* Wave 21: Shelf Gallery logic tests.
   Run against the REAL archive (data/figures.json) — figure ids, names,
   series, and rarity signals come from the dataset, never fixtures. */
"use strict";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { suite, test, assert } from "./assert.js";
import {
  LAYOUTS, layoutById, FULL_PRESET, DOWNSCALE_PRESET, STORAGE_SOFT_CAP,
  MAX_CAPTION, MAX_TAGS_PER_PHOTO,
  defaultShelves, addShelf, renameShelf, removeShelf, setLayout,
  addPhoto, removePhoto, movePhoto, updatePhoto, setPhotoTags,
  sanitizeGallery, photoTotalBytes, storageStatus,
  rarityScore, rarestOwned, latestGrailShelfie, galleryStats, buildShelfieCard,
} from "../assets/js/gallery-core.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = JSON.parse(readFileSync(join(ROOT, "data/figures.json"), "utf8"));
const figures = [];
for (const w of raw.waves ?? []) {
  for (const f of w.figures ?? []) {
    figures.push({
      id: `${w.id}::${f.name}`,
      waveId: w.id, waveSeries: w.series, year: w.year, manufacturer: w.manufacturer,
      ...f,
    });
  }
}
const byId = new Map(figures.map((f) => [f.id, f]));
const validIds = new Set(byId.keys());

/* Real archive ids used below (verified present in data/figures.json). */
const CHASE = "toybiz-2002-series-2::Doombot";   // notes: "Chase-style variant" + variant
const CHASE2 = "toybiz-2003-series-5::Red Skull"; // notes say "chase"
const CONV = "hasbro-2007-sdcc::She-Hulk";       // exclusive: San Diego Comic-Con
const PLAIN = "hasbro-2007-annihilus::Beast";    // plain retail figure
const BOGUS = "wave-9999::Fake Figure";

const FAKE_IMG = "data:image/jpeg;base64,/9j/FAKE";

function shelfWithPhotos() {
  let s = defaultShelves();
  const id = s.shelves[0].id;
  s = addPhoto(s, id, { dataUrl: FAKE_IMG + "a", caption: "one", tags: [CHASE], ts: 1000 });
  s = addPhoto(s, id, { dataUrl: FAKE_IMG + "b", caption: "two", tags: [CONV], ts: 2000 });
  s = addPhoto(s, id, { dataUrl: FAKE_IMG + "c", caption: "three", tags: [PLAIN], ts: 3000 });
  return { state: s, shelfId: id };
}

suite("gallery layouts", () => {
  test("three templates exist with expected ids", () => {
    assert.deepEqual(LAYOUTS.map((l) => l.id), ["grid", "run", "baf"]);
    for (const l of LAYOUTS) assert(l.name && l.blurb, `layout ${l.id} needs name+blurb`);
  });

  test("layoutById falls back to grid for junk", () => {
    assert.equal(layoutById("nope").id, "grid");
    assert.equal(layoutById("run").id, "run");
  });

  test("setLayout applies a known layout and ignores junk", () => {
    let s = defaultShelves();
    const id = s.shelves[0].id;
    s = setLayout(s, id, "baf");
    assert.equal(s.shelves[0].layout, "baf");
    s = setLayout(s, id, "junk");
    assert.equal(s.shelves[0].layout, "baf");
  });

  test("presets are sane JPEG re-encode settings", () => {
    assert.equal(FULL_PRESET.mime, "image/jpeg");
    assert(FULL_PRESET.maxDim >= DOWNSCALE_PRESET.maxDim, "downscale preset is smaller");
    assert(STORAGE_SOFT_CAP < 5 * 1024 * 1024, "soft cap stays under the ~5MB quota");
  });
});

suite("gallery shelves", () => {
  test("defaultShelves ships two shelves", () => {
    const s = defaultShelves();
    assert.equal(s.shelves.length, 2);
    assert(s.shelves.every((x) => x.id && x.photos.length === 0));
  });

  test("addShelf trims and falls back to a default name", () => {
    let s = defaultShelves();
    s = addShelf(s, "  Detolf  ");
    assert.equal(s.shelves.at(-1).name, "Detolf");
    s = addShelf(s, "   ");
    assert.equal(s.shelves.at(-1).name, "New shelf");
    assert.equal(s.shelves.at(-1).layout, "grid");
  });

  test("renameShelf ignores empty names", () => {
    let s = defaultShelves();
    const id = s.shelves[0].id;
    const before = s.shelves[0].name;
    s = renameShelf(s, id, "   ");
    assert.equal(s.shelves[0].name, before);
    s = renameShelf(s, id, "Cabinet A");
    assert.equal(s.shelves[0].name, "Cabinet A");
  });

  test("removeShelf drops only that shelf", () => {
    let s = defaultShelves();
    const keep = s.shelves[1].id;
    s = removeShelf(s, s.shelves[0].id);
    assert.equal(s.shelves.length, 1);
    assert.equal(s.shelves[0].id, keep);
  });
});

suite("gallery photos", () => {
  test("addPhoto rejects non-image data URLs", () => {
    let s = defaultShelves();
    const id = s.shelves[0].id;
    const same = addPhoto(s, id, { dataUrl: "not-an-image" });
    assert.equal(same.shelves[0].photos.length, 0);
    s = addPhoto(s, id, { dataUrl: FAKE_IMG });
    assert.equal(s.shelves[0].photos.length, 1);
    assert.equal(s.shelves[0].photos[0].caption, "");
  });

  test("addPhoto caps captions", () => {
    let s = defaultShelves();
    s = addPhoto(s, s.shelves[0].id, { dataUrl: FAKE_IMG, caption: "x".repeat(500) });
    assert.equal(s.shelves[0].photos[0].caption.length, MAX_CAPTION);
  });

  test("movePhoto swaps neighbors and clamps at edges", () => {
    const { state, shelfId } = shelfWithPhotos();
    const ids = state.shelves[0].photos.map((p) => p.id);
    let s = movePhoto(state, shelfId, ids[1], -1);
    assert.deepEqual(s.shelves[0].photos.map((p) => p.id), [ids[1], ids[0], ids[2]]);
    s = movePhoto(state, shelfId, ids[0], -1);
    assert.deepEqual(s.shelves[0].photos.map((p) => p.id), ids); // clamped, unchanged
    s = movePhoto(state, shelfId, ids[2], 1);
    assert.deepEqual(s.shelves[0].photos.map((p) => p.id), ids); // clamped, unchanged
    s = movePhoto(state, shelfId, "nope", 1);
    assert.deepEqual(s.shelves[0].photos.map((p) => p.id), ids); // unknown, unchanged
  });

  test("updatePhoto caps captions; removePhoto drops one", () => {
    let { state, shelfId } = shelfWithPhotos();
    const id = state.shelves[0].photos[0].id;
    state = updatePhoto(state, shelfId, id, { caption: "y".repeat(300) });
    assert.equal(state.shelves[0].photos[0].caption.length, MAX_CAPTION);
    state = removePhoto(state, shelfId, id);
    assert.equal(state.shelves[0].photos.length, 2);
  });
});

suite("gallery tagging (real figure ids)", () => {
  test("setPhotoTags keeps only real ids, dedupes, caps at 6", () => {
    let { state, shelfId } = shelfWithPhotos();
    const id = state.shelves[0].photos[0].id;
    state = setPhotoTags(state, shelfId, id,
      [CHASE, BOGUS, CHASE, CONV, PLAIN, CHASE2, BOGUS, "toybiz-2002-series-1::Hulk", PLAIN],
      validIds);
    const tags = state.shelves[0].photos[0].tags;
    assert(!tags.includes(BOGUS), "bogus ids are dropped");
    assert.deepEqual(tags, [CHASE, CONV, PLAIN, CHASE2, "toybiz-2002-series-1::Hulk"],
      "all 5 unique real ids kept, bogus dropped, dupes collapsed");
    assert(tags.every((t) => validIds.has(t)), "every tag is a real archive id");

    // Over the cap: 7 unique real ids -> first 6 win.
    state = setPhotoTags(state, shelfId, id,
      [CHASE, CHASE2, CONV, PLAIN, "toybiz-2002-series-1::Hulk",
       "hasbro-2007-sdcc::Stan Lee", "hasbro-2008-sdcc-fff::Absorbing Man"],
      validIds);
    const capped = state.shelves[0].photos[0].tags;
    assert.equal(capped.length, MAX_TAGS_PER_PHOTO);
    assert(!capped.includes("hasbro-2008-sdcc-fff::Absorbing Man"), "7th tag dropped at the cap");
  });

  test("setPhotoTags accepts an all-real tag set", () => {
    let { state, shelfId } = shelfWithPhotos();
    const id = state.shelves[0].photos[0].id;
    state = setPhotoTags(state, shelfId, id, [CONV, CHASE2], validIds);
    assert.deepEqual(state.shelves[0].photos[0].tags, [CONV, CHASE2]);
  });

  test("sanitizeGallery drops bad photos, fixes layout, filters tags", () => {
    const dirty = {
      shelves: [{
        id: "s1", name: "x", layout: "junk-layout",
        photos: [
          { id: "p1", dataUrl: FAKE_IMG, caption: "ok", tags: [CHASE, BOGUS], ts: 1 },
          { id: "p2", dataUrl: "http://evil/x.png", caption: "bad", tags: [], ts: 2 },
          { id: "p3", caption: "no url", tags: [], ts: 3 },
        ],
      }],
    };
    const clean = sanitizeGallery(dirty, validIds);
    assert.equal(clean.shelves[0].layout, "grid");
    assert.equal(clean.shelves[0].photos.length, 1);
    assert.deepEqual(clean.shelves[0].photos[0].tags, [CHASE]);
  });
});

suite("gallery storage budget", () => {
  test("photoTotalBytes sums dataURL lengths", () => {
    const { state } = shelfWithPhotos();
    const expected = state.shelves[0].photos.reduce((n, p) => n + p.dataUrl.length, 0);
    assert.equal(photoTotalBytes(state), expected);
  });

  test("storageStatus thresholds", () => {
    assert.equal(storageStatus(0), "ok");
    assert.equal(storageStatus(STORAGE_SOFT_CAP * 0.5), "ok");
    assert.equal(storageStatus(Math.ceil(STORAGE_SOFT_CAP * 0.75)), "near");
    assert.equal(storageStatus(STORAGE_SOFT_CAP), "full");
    assert.equal(storageStatus(STORAGE_SOFT_CAP + 1), "full");
  });
});

suite("gallery rarity (archive signals)", () => {
  test("rarestOwned ranks chase above convention exclusive above plain", () => {
    assert.equal(rarestOwned(figures, [PLAIN, CONV]).id, CONV);
    assert.equal(rarestOwned(figures, [CONV, CHASE]).id, CHASE);
    assert.equal(rarestOwned(figures, [CHASE, CHASE2]).id, CHASE); // variant bonus wins tie
  });

  test("rarestOwned returns null when nothing owned is rare", () => {
    assert.equal(rarestOwned(figures, [PLAIN]), null);
    assert.equal(rarestOwned(figures, []), null);
  });

  test("rarityScore is 0 for a plain figure", () => {
    assert.equal(rarityScore(byId.get(PLAIN)), 0);
    assert(rarityScore(byId.get(CHASE)) > rarityScore(byId.get(CONV)) , "chase outranks con exclusive");
  });

  test("latestGrailShelfie picks the newest rare-tagged photo", () => {
    const { state } = shelfWithPhotos(); // ts 1000 chase, 2000 conv, 3000 plain
    const hit = latestGrailShelfie(state, byId);
    assert(hit, "found a grail-worthy photo");
    assert.equal(hit.fig.id, CONV, "newest rare tag wins over the older chase");
    assert.equal(hit.photo.caption, "two");
  });
});

suite("gallery share card", () => {
  function questFixture() {
    return {
      level: { title: "Collector", level: 1, xp: 30 },
      ownedCount: 30,
      archiveCount: figures.length,
      completedBafs: 1,
      achievements: [{ id: "a", name: "First Steps", icon: "🐾", unlocked: true }],
      latestAchievement: { icon: "🐾", name: "First Steps" },
    };
  }

  test("share card names real top figures, completion %, and the latest grail", () => {
    const { state } = shelfWithPhotos();
    const card = buildShelfieCard({ gallery: state, byId, quest: questFixture() });
    assert(card.includes("📸 My Legends Shelfie"), "gallery header line");
    assert(card.includes("3 photos"), "photo count");
    assert(card.includes("Doombot"), "real top-tagged figure name, not an id");
    assert(card.includes("She-Hulk"), "second tagged figure");
    const pct = Math.round((30 / figures.length) * 100);
    assert(card.includes(`${pct}%`), `completion % (${pct}%) from real archive count`);
    assert(card.includes("Collector"), "quest level title via shared quest logic");
    assert(card.includes("👑 Latest grail-worthy shelfie: She-Hulk"), "latest grail line with real name");
    assert(card.includes("San Diego Comic-Con Exclusives (2007)"), "real wave series + year, nothing invented");
  });

  test("share card handles an empty gallery honestly", () => {
    const card = buildShelfieCard({ gallery: defaultShelves(), byId, quest: questFixture() });
    assert(card.includes("No shelfie photos yet"), "honest empty state");
    assert(card.includes("Collector"), "quest section still present");
    assert(!card.includes("👑"), "no grail line without rare tags");
  });

  test("galleryStats counts shelves, photos, tags, and top figures", () => {
    const { state } = shelfWithPhotos();
    const stats = galleryStats(state, byId);
    assert.equal(stats.shelves, 2);
    assert.equal(stats.photos, 3);
    assert.equal(stats.tagged, 3);
    assert.equal(stats.uniqueFigures, 3);
    assert.equal(stats.topFigures.length, 3);
    assert(stats.topFigures.every((t) => t.name && typeof t.count === "number"));
  });
});
