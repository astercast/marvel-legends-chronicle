/* Shareable collection summary, builds a clean text snapshot of the shelf
   for pasting into forums/Discord. Read-only over existing localStorage. */
import { STORE_KEYS } from "./config.js";
import { loadData } from "./data.js";
import { load } from "./store.js";
import { escapeHtml } from "./figure-dialog.js";
import { ERAS, eraForYear } from "./era-bands.js";

const els = {
  panel: document.getElementById("shelf-share"),
  preview: document.getElementById("share-preview"),
  copy: document.getElementById("share-copy"),
  status: document.getElementById("share-status"),
};

/* Same piece-carrier mapping as the BAF planner / shelf.js. */
function buildBafs(waves) {
  const out = [];
  for (const w of waves) {
    if (!w.baf) continue;
    const pieces = new Map();
    for (const f of w.figures) {
      if (!f.bafPiece) continue;
      const id = `${w.id}::${f.name}`;
      if (!pieces.has(f.bafPiece)) pieces.set(f.bafPiece, new Set());
      pieces.get(f.bafPiece).add(id);
    }
    if (pieces.size) out.push({ name: w.baf, year: w.year, pieces: [...pieces.values()] });
  }
  return out;
}

function buildSummary(figures, waves, ownedIds, wantedIds) {
  const byId = new Map(figures.map((f) => [f.id, f]));
  const ownedFigs = [...ownedIds].map((id) => byId.get(id)).filter(Boolean);
  const total = figures.length;
  const pct = total ? ((ownedFigs.length / total) * 100).toFixed(1) : "0.0";

  const byChar = {};
  for (const f of ownedFigs) byChar[f.name] = (byChar[f.name] ?? 0) + 1;
  const topChars = Object.entries(byChar).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const bafs = buildBafs(waves);
  const complete = bafs.filter((b) =>
    b.pieces.every((carriers) => carriers.some((id) => ownedIds.has(id))));

  const eraCounts = ERAS.map((e) => {
    const eraFigs = figures.filter((f) => { const er = eraForYear(f.year); return er && er.id === e.id; });
    const got = ownedFigs.filter((f) => { const er = eraForYear(f.year); return er && er.id === e.id; }).length;
    return { name: e.title, got, total: eraFigs.length };
  }).filter((e) => e.total > 0);

  const wanted = [...wantedIds].filter((id) => byId.has(id)).length;

  const lines = [
    "My Marvel Legends shelf, via Marvel Legends Chronicle",
    `Owned: ${ownedFigs.length.toLocaleString()} / ${total.toLocaleString()} figures (${pct}%)`,
  ];
  if (topChars.length) lines.push(`Top characters: ${topChars.map(([n, c]) => `${n} ×${c}`).join(", ")}`);
  lines.push(`BAFs complete: ${complete.length} of ${bafs.length}${complete.length ? `, ${complete.slice(0, 5).map((b) => b.name).join(", ")}${complete.length > 5 ? ` +${complete.length - 5} more` : ""}` : ""}`);
  lines.push(`By era: ${eraCounts.map((e) => `${e.name} ${e.got}/${e.total}`).join(" · ")}`);
  if (wanted) lines.push(`Want list: ${wanted} figures`);
  return lines.join("\n");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

async function main() {
  if (!els.panel) return;
  let data;
  try {
    data = await loadData();
  } catch {
    els.panel.hidden = true;
    return;
  }
  const { waves, figures } = data;
  const ownedIds = new Set(load(STORE_KEYS.owned, []));
  const wantedIds = new Set(load(STORE_KEYS.wanted, []));
  if (!ownedIds.size && !wantedIds.size) {
    els.panel.hidden = true; // nothing to share yet
    return;
  }
  const text = buildSummary(figures, waves, ownedIds, wantedIds);
  els.preview.textContent = text;
  els.copy.addEventListener("click", async () => {
    const ok = await copyText(text);
    els.status.textContent = ok ? "Copied to clipboard, paste it anywhere." : "Copy failed, select the text above and copy manually.";
  });
}

main();
