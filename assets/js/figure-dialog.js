/* Figure detail dialog — specs, BAF piece, notes, tracker, marketplace links. */
import { openModal } from "./modal.js";
import { trackerButtons, owned, wanted, watching } from "./tracker.js";
import { renderMarketplaceLinks, renderResearchLinks } from "./listings.js";
import { STORE_KEYS } from "./config.js";
import { load } from "./store.js";
import { entriesForFigure, trendStats, sparklineSVG, directionBadge } from "./price-trends.js";

export function badgeFor(fig) {
  const badges = [];
  if (fig.waveBaf) badges.push(`<span class="badge badge-baf">BAF: ${escapeHtml(fig.waveBaf)}</span>`);
  if (fig.exclusive) badges.push(`<span class="badge badge-exclusive">${escapeHtml(fig.exclusive)}</span>`);
  if (fig.variant) badges.push(`<span class="badge badge-variant">${escapeHtml(fig.variant)}</span>`);
  if (fig.bafPiece) badges.push(`<span class="badge">Builds: ${escapeHtml(fig.bafPiece)}</span>`);
  if (fig.source) {
    const label = { mcu: "MCU", animated: "Animated", videogame: "Video game" }[fig.source] ?? fig.source;
    badges.push(`<span class="badge badge-source">${escapeHtml(label)}</span>`);
  }
  return badges.join("");
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/* Character pages (characters/<slug>.html) — lazy index so the dialog can link
   "Every <character> release →" when one exists.
   Resolved against this module's own URL (always <root>/assets/js/) so the
   fetch works at any page depth — a document-relative "characters/…"
   path 404s on characters/*.html. */
const charIndex = new Map();
const manifestUrl = new URL("../../characters/manifest.json", import.meta.url);
fetch(manifestUrl)
  .then((r) => (r.ok ? r.json() : []))
  .then((m) => {
    for (const c of m) charIndex.set(String(c.name).toLowerCase(), c.slug);
  })
  .catch(() => {});

function characterLinkFor(name) {
  const base = String(name).replace(/\s*\(.*?\)\s*/g, "").trim();
  const slug = charIndex.get(base.toLowerCase());
  return slug ? { base, slug } : null;
}

export function openFigureDialog(fig) {
  openModal((titleEl, bodyEl) => {
    titleEl.textContent = fig.name;
    const dl = document.createElement("dl");
    dl.className = "kv";
    const rows = [
      ["Wave", fig.waveSeries],
      ["Year", fig.year],
      ["Manufacturer", fig.manufacturer],
      ...(fig.variant ? [["Variant", fig.variant]] : []),
      ...(fig.exclusive ? [["Exclusive", fig.exclusive]] : []),
      ...(fig.bafPiece ? [["BAF piece", fig.bafPiece]] : []),
      ...(fig.waveBaf ? [["Wave BAF", fig.waveBaf]] : []),
      ...(fig.notes ? [["Notes", fig.notes]] : []),
    ];
    for (const [k, v] of rows) {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      dl.append(dt, dd);
    }
    bodyEl.appendChild(dl);

    const status = document.createElement("p");
    status.style.cssText = "font-size:0.85rem;color:var(--muted);";
    const flags = [];
    if (owned.has(fig.id)) flags.push("in your collection");
    if (wanted.has(fig.id)) flags.push("on your want list");
    if (watching.has(fig.id)) flags.push("on your watch list");
    status.textContent = flags.length ? `Status: ${flags.join(", ")}.` : "Not tracked yet.";
    bodyEl.appendChild(status);

    const cl = characterLinkFor(fig.name);
    if (cl) {
      const charLink = document.createElement("a");
      charLink.className = "btn btn-sm";
      charLink.href = `characters/${cl.slug}.html`;
      charLink.textContent = `Every ${cl.base} release →`;
      charLink.style.marginBottom = "var(--space-3)";
      bodyEl.appendChild(charLink);
    }

    /* VS-mode entry point (wave 26): compare this figure against any other.
       URL is resolved against the current page so it works from any depth. */
    const cmpLink = document.createElement("a");
    cmpLink.className = "btn btn-sm";
    const cmpUrl = new URL("compare.html", location.href);
    cmpUrl.searchParams.set("a", fig.id);
    cmpLink.href = cmpUrl.href;
    cmpLink.textContent = "⚖️ Compare this figure";
    cmpLink.style.marginBottom = "var(--space-3)";
    cmpLink.style.marginLeft = "var(--space-2)";
    bodyEl.appendChild(cmpLink);

    bodyEl.appendChild(trackerButtons(fig.id));
    bodyEl.appendChild(renderMarketplaceLinks(fig));
    bodyEl.appendChild(renderResearchLinks(fig));

    /* Your logged prices — from the user's own journal entries only. */
    try {
      const entries = entriesForFigure(load(STORE_KEYS.journal, []), fig.id, fig.name);
      if (entries.length) {
        const wrap = document.createElement("div");
        wrap.className = "logged-prices";
        const head = document.createElement("h3");
        head.className = "dialog-subhead";
        head.textContent = "Your logged prices";
        wrap.appendChild(head);
        const trend = trendStats(entries);
        const dated = entries.filter((e) => e && Number.isFinite(Number(e.price)));
        const med = dated.length
          ? (() => { const s = dated.map((e) => Number(e.price)).sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; })()
          : 0;
        wrap.insertAdjacentHTML("beforeend",
          `<p class="link-note">${entries.length} logged ${entries.length === 1 ? "sale" : "sales"} · median $${med.toFixed(2)}${trend ? ` · ${directionBadge(trend.direction)} <span class="muted">(${trend.changePct >= 0 ? "+" : ""}${trend.changePct.toFixed(0)}% first→last)</span>` : ""}</p>` +
          (sparklineSVG(entries) || "") +
          `<p class="link-note">From sales you logged — <a href="journal.html">open the journal</a>.</p>`);
        bodyEl.appendChild(wrap);
      }
    } catch { /* journal unreadable — skip silently */ }
  });
}
