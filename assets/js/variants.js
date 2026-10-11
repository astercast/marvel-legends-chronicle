/* Variant & chase identifier — wave-by-wave index from figures.json. */
import { loadData } from "./data.js";
import { escapeHtml } from "./figure-dialog.js";

const els = {
  index: document.getElementById("variant-index"),
  search: document.getElementById("v-search"),
  era: document.getElementById("v-era"),
  count: document.getElementById("variant-count"),
};

function state() {
  return { q: els.search.value.trim().toLowerCase(), era: els.era.value };
}

function matches(fig, wave, s) {
  if (s.era !== "all" && wave.manufacturer !== s.era) return false;
  if (!s.q) return true;
  return (
    fig.name.toLowerCase().includes(s.q) ||
    (fig.variant ?? "").toLowerCase().includes(s.q) ||
    (fig.notes ?? "").toLowerCase().includes(s.q) ||
    wave.series.toLowerCase().includes(s.q)
  );
}

function render(waves) {
  const s = state();
  els.index.innerHTML = "";
  let waveCount = 0;
  let figCount = 0;

  for (const wave of waves) {
    const variants = (wave.figures ?? []).filter((f) => f.variant && matches(f, wave, s));
    if (!variants.length) continue;
    waveCount += 1;
    figCount += variants.length;

    const section = document.createElement("section");
    section.className = "variant-wave";
    section.innerHTML = `
      <h2>${escapeHtml(wave.series)}</h2>
      <p class="wave-meta">${wave.year} · <span class="badge ${wave.manufacturer === "Toy Biz" ? "badge-toybiz" : ""}">${escapeHtml(wave.manufacturer)}</span> · ${variants.length} variant${variants.length === 1 ? "" : "s"}</p>`;
    const list = document.createElement("ul");
    list.className = "variant-list";
    for (const fig of variants) {
      const li = document.createElement("li");
      li.className = "variant-item card";
      const extras = [fig.exclusive, fig.bafPiece ? `Builds ${fig.bafPiece}` : null].filter(Boolean);
      li.innerHTML = `
        <div class="v-name">${escapeHtml(fig.name)}</div>
        <div class="tag-row"><span class="badge badge-variant">${escapeHtml(fig.variant)}</span>${extras.map((e) => `<span class="badge">${escapeHtml(e)}</span>`).join("")}</div>
        ${fig.notes ? `<p class="v-notes">${escapeHtml(fig.notes)}</p>` : ""}
        <p class="v-desc">Regular release: the standard <strong>${escapeHtml(fig.name)}</strong> from this wave — compare deco, sculpt, and packaging against the variant described above.</p>`;
      list.appendChild(li);
    }
    section.appendChild(list);
    els.index.appendChild(section);
  }

  if (els.count) {
    els.count.textContent = `${figCount} documented variant${figCount === 1 ? "" : "s"} across ${waveCount} wave${waveCount === 1 ? "" : "s"}.`;
  }
  if (!waveCount) {
    els.index.innerHTML = `<div class="empty-state"><p>No variants match that search.</p></div>`;
  }
}

async function init() {
  try {
    const { waves } = await loadData();
    const sorted = [...waves].sort((a, b) => a.year - b.year);
    let debounce;
    const rerender = () => render(sorted);
    els.search.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(rerender, 180);
    });
    els.era.addEventListener("change", rerender);
    render(sorted);
  } catch (err) {
    console.error(err);
    els.index.innerHTML = `<div class="empty-state"><p>Could not load the figure database. Check your connection and reload.</p></div>`;
  }
}

init();
