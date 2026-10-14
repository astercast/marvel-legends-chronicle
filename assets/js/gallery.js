/* Shelf Gallery, the visual heart of Showcase 2.0.
   Photo slots per shelf: the user adds their OWN photos via file input.
   Photos are stored as dataURLs in localStorage (client-side only, nothing
   is ever uploaded anywhere). Canvas re-encoding strips EXIF on import.
   Captions + figure-tagging per photo (tags validated against real archive
   figure ids via gallery-core). Shelf layout templates (grid, character-run
   row, BAF centerpiece). Reorder by drag-free arrow buttons or Left/Right
   arrow keys on a focused photo, keyboard is the full path.
   Quota handling: proactive soft-cap banner + graceful "storage full" with a
   one-click downscale option. Reduced-motion safe (no transitions). */
import { STORE_KEYS } from "./config.js";
import { loadData, figureById } from "./data.js";
import { load } from "./store.js";
import { escapeHtml } from "./figure-dialog.js";
import { owned } from "./tracker.js";
import { computeAchievements, computeLevel } from "./quest-core.js";
import { buildBafs } from "./baf-planner.js";
import {
  LAYOUTS, layoutById, FULL_PRESET, DOWNSCALE_PRESET,
  defaultShelves,
  addShelf, renameShelf, removeShelf, setLayout,
  addPhoto, removePhoto, movePhoto, updatePhoto, setPhotoTags,
  sanitizeGallery, photoTotalBytes, storageStatus,
  rarestOwned, buildShelfieCard,
} from "./gallery-core.js";

const els = {
  stripLevel: document.getElementById("quest-strip-level"),
  stripAch: document.getElementById("quest-strip-ach"),
  stripRarest: document.getElementById("quest-strip-rarest"),
  shelves: document.getElementById("gallery-shelves"),
  btnAddShelf: document.getElementById("btn-add-shelf"),
  storage: document.getElementById("gallery-storage"),
  storageText: document.getElementById("gallery-storage-text"),
  btnDownscale: document.getElementById("btn-downscale"),
  figList: document.getElementById("gallery-figure-list"),
  shareText: document.getElementById("shelfie-text"),
  shareCopy: document.getElementById("shelfie-copy"),
  shareStatus: document.getElementById("shelfie-status"),
};

let figures = [];
let waves = [];
let byId = new Map();
let labelToId = new Map();
let state = defaultShelves();
let quotaFull = false;

function figLabel(fig) {
  return `${fig.name}, ${fig.waveSeries} (${fig.year})`;
}

/* Persist with quota detection. Returns true on success; on quota
   failure shows the full banner and returns false (state stays in
   memory so nothing the user just did is silently lost). */
function persist() {
  try {
    localStorage.setItem(STORE_KEYS.gallery, JSON.stringify(state));
    quotaFull = false;
    return true;
  } catch (err) {
    const msg = `${err?.name ?? ""} ${err?.code ?? ""} ${err?.message ?? ""}`;
    if (/quota/i.test(msg)) {
      quotaFull = true;
      showStorageBanner("full", true);
    }
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Quest header strip, cross-links the Grail Quest into the gallery.  */

function renderQuestStrip() {
  const ownedIds = owned.all();
  const ownedSet = new Set(ownedIds);
  const achievements = computeAchievements(figures, waves, ownedIds);
  const unlocked = achievements.filter((a) => a.unlocked);
  const bafs = buildBafs(waves);
  const completedBafs = bafs.filter((b) =>
    b.pieces.every((p) => p.carriers.some((c) => ownedSet.has(c.id)))).length;
  const level = computeLevel(ownedIds.length, completedBafs, unlocked.length);
  const rarest = rarestOwned(figures, ownedIds);

  if (els.stripLevel) {
    els.stripLevel.innerHTML = `<strong>${escapeHtml(level.title)}</strong>`
      + `, Level ${level.level + 1} · ${level.xp} XP`;
  }
  if (els.stripAch) {
    els.stripAch.textContent = `${unlocked.length}/${achievements.length} achievements unlocked`;
  }
  if (els.stripRarest) {
    els.stripRarest.textContent = rarest
      ? `Rarest owned: ${rarest.name}, ${rarest.waveSeries} (${rarest.year})`
      : "Rarest owned:, (tag a chase or convention exclusive)";
  }
  return { level, achievements, unlocked, completedBafs, ownedIds };
}

function refreshShelfieCard(quest) {
  if (!els.shareText) return;
  const latestAchievement = [...quest.unlocked].pop() ?? null;
  els.shareText.value = buildShelfieCard({
    gallery: state,
    byId,
    quest: {
      level: quest.level,
      ownedCount: quest.ownedIds.length,
      archiveCount: figures.length,
      completedBafs: quest.completedBafs,
      achievements: quest.achievements,
      latestAchievement,
    },
  });
}

/* ------------------------------------------------------------------ */
/* Storage banner                                                      */

function showStorageBanner(status, hardFail) {
  if (!els.storage) return;
  els.storage.hidden = false;
  if (hardFail || status === "full") {
    els.storageText.innerHTML = "<strong>Storage is full.</strong> Your photos stay on this device, "
      + "the browser won't take more. Downscale every photo (smaller, still clear) or remove some photos.";
  } else {
    els.storageText.innerHTML = "<strong>Storage is getting full</strong> (over 75% of the gallery budget). "
      + "Consider downscaling photos now to keep room for more.";
  }
}

function refreshStorageBanner() {
  if (quotaFull) return; // hard banner stays until a save succeeds
  const status = storageStatus(photoTotalBytes(state));
  if (status === "ok") {
    if (els.storage) els.storage.hidden = true;
  } else {
    showStorageBanner(status, false);
  }
}

/* ------------------------------------------------------------------ */
/* Image import, file input → canvas re-encode (strips EXIF) → dataURL */

function processImage(file, preset) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) { reject(new Error("not-image")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, preset.maxDim / Math.max(img.naturalWidth, img.naturalHeight, 1));
          const w = Math.max(1, Math.round(img.naturalWidth * scale));
          const h = Math.max(1, Math.round(img.naturalHeight * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL(preset.mime, preset.quality));
        } catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error("decode"));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function reencodeDataUrl(dataUrl, preset) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, preset.maxDim / Math.max(img.naturalWidth, img.naturalHeight, 1));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL(preset.mime, preset.quality));
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error("decode"));
    img.src = dataUrl;
  });
}

async function downscaleAll() {
  els.btnDownscale.disabled = true;
  els.shareStatus && (els.shareStatus.textContent = "");
  const next = JSON.parse(JSON.stringify(state));
  try {
    for (const shelf of next.shelves) {
      for (const photo of shelf.photos) {
        photo.dataUrl = await reencodeDataUrl(photo.dataUrl, DOWNSCALE_PRESET);
      }
    }
    state = next;
    if (persist()) {
      quotaFull = false;
      render();
    }
  } catch {
    if (els.storageText) {
      els.storageText.innerHTML = "<strong>Downscale didn't finish.</strong> "
        + "Try removing a photo or two, then downscale again.";
    }
    els.storage.hidden = false;
  } finally {
    els.btnDownscale.disabled = false;
  }
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */

function tagChips(photo) {
  return photo.tags.map((id) => {
    const fig = byId.get(id);
    const name = fig ? fig.name : id;
    return `<span class="g-chip">${escapeHtml(name)}`
      + `<button type="button" class="g-chip-x" data-untag="${escapeHtml(id)}" `
      + `aria-label="Remove tag ${escapeHtml(name)}">×</button></span>`;
  }).join("");
}

function photoEl(shelf, photo) {
  const fig = document.createElement("figure");
  fig.className = "g-photo";
  fig.dataset.photoId = photo.id;
  fig.tabIndex = 0;
  const capText = photo.caption ? `: ${photo.caption}` : "";
  fig.setAttribute("aria-label", `Shelf photo${capText}. Left and right arrow keys reorder.`);

  const img = document.createElement("img");
  img.src = photo.dataUrl;
  img.alt = photo.caption || "Shelf photo";
  img.loading = "lazy";
  fig.appendChild(img);

  const cap = document.createElement("figcaption");
  cap.innerHTML = `
    <label class="g-field">Caption
      <input type="text" class="input g-caption" maxlength="140"
        placeholder="The detolf, Sunday light…" value="">
    </label>
    <div class="g-chips" aria-label="Tagged figures">${tagChips(photo)}</div>
    <div class="g-tag-add">
      <label class="g-field">Tag a figure
        <input type="text" class="input g-tag-input" list="gallery-figure-list"
          autocomplete="off" placeholder="Start typing a figure name…">
      </label>
      <button type="button" class="btn btn-sm g-tag-btn">Tag</button>
    </div>
    <div class="g-actions">
      <button type="button" class="btn btn-sm" data-mv="-1" aria-label="Move photo earlier">←</button>
      <button type="button" class="btn btn-sm" data-mv="1" aria-label="Move photo later">→</button>
      <button type="button" class="btn btn-sm" data-del>Remove photo</button>
    </div>`;
  cap.querySelector(".g-caption").value = photo.caption ?? "";
  fig.appendChild(cap);

  cap.querySelector(".g-caption").addEventListener("change", (e) => {
    state = updatePhoto(state, shelf.id, photo.id, { caption: e.target.value });
    if (persist()) render();
  });

  const addTag = () => {
    const input = cap.querySelector(".g-tag-input");
    const label = input.value.trim();
    const id = labelToId.get(label);
    if (!id) {
      input.setAttribute("aria-invalid", "true");
      input.title = "Pick a figure from the suggestions, tags must match the archive.";
      return;
    }
    input.removeAttribute("aria-invalid");
    input.title = "";
    input.value = "";
    state = setPhotoTags(state, shelf.id, photo.id, [...photo.tags, id], new Set(byId.keys()));
    if (persist()) render();
  };
  cap.querySelector(".g-tag-btn").addEventListener("click", addTag);
  cap.querySelector(".g-tag-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); addTag(); }
  });
  cap.querySelectorAll("[data-untag]").forEach((b) =>
    b.addEventListener("click", () => {
      state = setPhotoTags(state, shelf.id, photo.id,
        photo.tags.filter((t) => t !== b.dataset.untag), new Set(byId.keys()));
      if (persist()) render();
    }));
  cap.querySelectorAll("[data-mv]").forEach((b) =>
    b.addEventListener("click", () => {
      state = movePhoto(state, shelf.id, photo.id, Number(b.dataset.mv));
      if (persist()) {
        render();
        // Keep keyboard focus on the moved photo.
        const el = els.shelves.querySelector(`[data-photo-id="${CSS.escape(photo.id)}"]`);
        el?.focus();
      }
    }));
  cap.querySelector("[data-del]").addEventListener("click", () => {
    if (confirm("Remove this photo from the shelf?")) {
      state = removePhoto(state, shelf.id, photo.id);
      if (persist()) render();
    }
  });

  // Arrow-key reorder: keyboard is a full path, buttons are not required.
  fig.addEventListener("keydown", (e) => {
    if (e.target !== fig) return; // let inputs/buttons handle their own keys
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      state = movePhoto(state, shelf.id, photo.id, e.key === "ArrowLeft" ? -1 : 1);
      if (persist()) {
        render();
        const el = els.shelves.querySelector(`[data-photo-id="${CSS.escape(photo.id)}"]`);
        el?.focus();
      }
    }
  });
  return fig;
}

function shelfEl(shelf) {
  const article = document.createElement("article");
  article.className = "g-shelf";
  article.dataset.shelfId = shelf.id;
  const layout = layoutById(shelf.layout);
  article.innerHTML = `
    <header class="g-shelf-head">
      <label class="g-field g-name-field"><span class="visually-hidden">Shelf name</span>
        <input type="text" class="input g-shelf-name" maxlength="60" value="">
      </label>
      <label class="g-field">Layout
        <select class="input g-layout">
          ${LAYOUTS.map((l) => `<option value="${l.id}"${l.id === layout.id ? " selected" : ""}>`
            + `${escapeHtml(l.name)}</option>`).join("")}
        </select>
      </label>
      <span class="chart-sub g-layout-blurb">${escapeHtml(layout.blurb)}</span>
      <div class="g-shelf-actions">
        <label class="btn btn-sm g-add-photo">Add photo
          <input type="file" class="visually-hidden" accept="image/*">
        </label>
        <button type="button" class="btn btn-sm" data-shelf-del>Remove shelf</button>
      </div>
    </header>
    <div class="g-photos layout-${layout.id}" role="list" aria-label="Photos on ${escapeHtml(shelf.name)}"></div>`;

  article.querySelector(".g-shelf-name").value = shelf.name;
  article.querySelector(".g-shelf-name").addEventListener("change", (e) => {
    state = renameShelf(state, shelf.id, e.target.value);
    if (persist()) render();
  });
  article.querySelector(".g-layout").addEventListener("change", (e) => {
    state = setLayout(state, shelf.id, e.target.value);
    if (persist()) render();
  });
  article.querySelector("[data-shelf-del]").addEventListener("click", () => {
    const n = shelf.photos.length;
    if (confirm(`Remove shelf “${shelf.name}”${n ? ` and its ${n} photo${n === 1 ? "" : "s"}` : ""}?`)) {
      state = removeShelf(state, shelf.id);
      if (persist()) render();
    }
  });

  const fileInput = article.querySelector('input[type="file"]');
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    try {
      const dataUrl = await processImage(file, FULL_PRESET);
      const before = state;
      state = addPhoto(state, shelf.id, { dataUrl });
      if (!persist()) { state = before; return; } // quota banner shown by persist()
      render();
    } catch {
      alert("That file couldn't be read as an image, try a JPG or PNG.");
    }
  });

  const grid = article.querySelector(".g-photos");
  for (const photo of shelf.photos) {
    const el = photoEl(shelf, photo);
    el.setAttribute("role", "listitem");
    grid.appendChild(el);
  }
  if (!shelf.photos.length) {
    const empty = document.createElement("p");
    empty.className = "chart-sub";
    empty.textContent = "No photos yet, add your own shelf photos with the button above.";
    grid.appendChild(empty);
  }
  return article;
}

function render() {
  els.shelves.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const shelf of state.shelves) frag.appendChild(shelfEl(shelf));
  els.shelves.appendChild(frag);
  if (!state.shelves.length) {
    els.shelves.innerHTML = `<div class="empty-state"><p>No shelves yet. Add your first shelf to start the gallery.</p></div>`;
  }
  refreshStorageBanner();
  const quest = renderQuestStrip();
  refreshShelfieCard(quest);
}

/* ------------------------------------------------------------------ */

function copyText(text, statusEl) {
  const done = (msg) => { if (statusEl) statusEl.textContent = msg; };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => done("Copied, paste it anywhere."),
      () => done("Copy didn't work, select the text manually."));
  } else {
    done("Copy isn't available, select the text manually.");
  }
}

async function main() {
  try {
    ({ figures, waves } = await loadData());
  } catch {
    if (els.shelves) {
      els.shelves.innerHTML = `<div class="empty-state"><p>Could not load the figure archive.</p></div>`;
    }
    return;
  }
  byId = new Map(figures.map((f) => [f.id, f]));
  labelToId = new Map(figures.map((f) => [figLabel(f), f.id]));

  // Figure suggestions for the tag inputs.
  if (els.figList) {
    const frag = document.createDocumentFragment();
    for (const f of figures) {
      const opt = document.createElement("option");
      opt.value = figLabel(f);
      frag.appendChild(opt);
    }
    els.figList.appendChild(frag);
  }

  const saved = load(STORE_KEYS.gallery, null);
  state = saved ? sanitizeGallery(saved, new Set(byId.keys())) : defaultShelves();

  els.btnAddShelf?.addEventListener("click", () => {
    state = addShelf(state);
    if (persist()) render();
  });
  els.btnDownscale?.addEventListener("click", downscaleAll);
  els.shareCopy?.addEventListener("click", () => copyText(els.shareText.value, els.shareStatus));

  render();
}

main();
