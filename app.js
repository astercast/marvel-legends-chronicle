/* Marvel Legends Chronicle — client-side mock-up.
   Collection tracking lives in localStorage only. Listing links are
   constructed marketplace search URLs (mock, no live inventory). */

const OWN_KEY = 'mlc_owned_v1';
const WANT_KEY = 'mlc_wanted_v1';

const load = (k) => { try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')); } catch { return new Set(); } };
const save = (k, s) => localStorage.setItem(k, JSON.stringify([...s]));
let owned = load(OWN_KEY);
let wanted = load(WANT_KEY);

let DATA = { waves: [] };

const figId = (w, f) => `${w.id}::${f.name}`;

const marketplaces = [
  { name: 'eBay', sub: 'Live + sold listings', url: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent('Marvel Legends ' + q)}` },
  { name: 'Amazon', sub: 'Current retail & marketplace', url: (q) => `https://www.amazon.com/s?k=${encodeURIComponent('Marvel Legends ' + q)}` },
  { name: 'Entertainment Earth', sub: 'Collector retailer', url: (q) => `https://www.entertainmentearth.com/search?s=${encodeURIComponent('Marvel Legends ' + q)}` },
  { name: 'BigBadToyStore', sub: 'Collector retailer', url: (q) => `https://www.bigbadtoystore.com/search?query=${encodeURIComponent('Marvel Legends ' + q)}` },
];

function stats() {
  document.getElementById('stat-owned').textContent = owned.size;
  document.getElementById('stat-wanted').textContent = wanted.size;
}

function matchesFilters(w, f) {
  const q = document.getElementById('search').value.trim().toLowerCase();
  const mfr = document.getElementById('filter-mfr').value;
  const era = document.getElementById('filter-era').value;
  const col = document.getElementById('filter-collection').value;
  const id = figId(w, f);
  if (q && !(f.name + ' ' + w.series + ' ' + (f.notes || '')).toLowerCase().includes(q)) return false;
  if (mfr && w.manufacturer !== mfr) return false;
  if (era && String(w.year) !== era) return false;
  if (col === 'owned' && !owned.has(id)) return false;
  if (col === 'wanted' && !wanted.has(id)) return false;
  return true;
}

function card(w, f) {
  const id = figId(w, f);
  const flags = [
    owned.has(id) ? '<span class="flag owned">OWNED</span>' : '',
    wanted.has(id) ? '<span class="flag wanted">WANTED</span>' : '',
  ].join('');
  return `<div class="card" data-wave="${w.id}" data-fig="${encodeURIComponent(f.name)}">
    <div class="flags">${flags}</div>
    <h3>${escapeHtml(f.name)}</h3>
    <div class="sub">${escapeHtml(w.series)} · ${w.year}</div>
    ${f.exclusive ? `<div class="exclusive">★ ${escapeHtml(f.exclusive)}</div>` : ''}
  </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function render() {
  const tl = document.getElementById('timeline');
  const byYear = {};
  for (const w of DATA.waves) {
    const figs = w.figures.filter((f) => matchesFilters(w, f));
    if (!figs.length) continue;
    (byYear[w.year] = byYear[w.year] || []).push({ w, figs });
  }
  const years = Object.keys(byYear).sort((a, b) => a - b);
  tl.innerHTML = years.map((y) => `
    <section class="year-block" id="year-${y}">
      <h2 class="year-title">${y}</h2>
      ${byYear[y].map(({ w, figs }) => `
        <div class="wave">
          <div class="wave-head">
            <span class="wave-name">${escapeHtml(w.series)}</span>
            <span class="badge ${w.manufacturer === 'Toy Biz' ? 'toybiz' : 'hasbro'}">${escapeHtml(w.manufacturer)}</span>
            ${w.sample ? '<span class="badge sample">sample data</span>' : ''}
            ${w.baf ? `<span class="baf-note">Build-A-Figure: ${escapeHtml(w.baf)}</span>` : ''}
          </div>
          <div class="cards">${figs.map((f) => card(w, f)).join('')}</div>
        </div>`).join('')}
    </section>`).join('') || '<p style="color:var(--muted)">No figures match those filters.</p>';

  // year rail
  const rail = document.getElementById('year-rail');
  rail.innerHTML = years.map((y) => `<a href="#year-${y}">${y}</a>`).join('');

  tl.querySelectorAll('.card').forEach((el) => {
    el.addEventListener('click', () => openModal(el.dataset.wave, decodeURIComponent(el.dataset.fig)));
  });
  stats();
}

function openModal(waveId, figName) {
  const w = DATA.waves.find((x) => x.id === waveId);
  const f = w.figures.find((x) => x.name === figName);
  const id = figId(w, f);
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <h2>${escapeHtml(f.name)}</h2>
    <div class="meta">${escapeHtml(w.series)} · ${escapeHtml(w.manufacturer)} · ${w.year}
      ${f.exclusive ? `<br>★ Exclusive: ${escapeHtml(f.exclusive)}` : ''}
      ${w.baf ? `<br>Build-A-Figure: ${escapeHtml(w.baf)}${f.bafPiece ? ` (includes ${escapeHtml(f.bafPiece)})` : ''}` : ''}
      ${f.notes ? `<br>${escapeHtml(f.notes)}` : ''}
    </div>
    <div class="tracker-row">
      <button class="btn own ${owned.has(id) ? 'on' : ''}" id="btn-own">${owned.has(id) ? '✓ In collection' : 'I own this'}</button>
      <button class="btn want ${wanted.has(id) ? 'on' : ''}" id="btn-want">${wanted.has(id) ? '✓ On wishlist' : 'Add to wishlist'}</button>
    </div>
    <div class="listings">
      <h3>Find it for sale (mock links)</h3>
      <ul>${marketplaces.map((m) => `<li><a href="${m.url(f.name)}" target="_blank" rel="noopener">${m.name}<small>${m.sub} — opens a pre-filled search</small></a></li>`).join('')}</ul>
    </div>`;
  document.getElementById('figure-modal').classList.remove('hidden');

  document.getElementById('btn-own').onclick = () => {
    owned.has(id) ? owned.delete(id) : (owned.add(id), wanted.delete(id));
    save(OWN_KEY, owned); save(WANT_KEY, wanted);
    openModal(waveId, figName); render();
  };
  document.getElementById('btn-want').onclick = () => {
    wanted.has(id) ? wanted.delete(id) : (wanted.add(id), owned.delete(id));
    save(OWN_KEY, owned); save(WANT_KEY, wanted);
    openModal(waveId, figName); render();
  };
}

document.getElementById('modal-close').onclick = () =>
  document.getElementById('figure-modal').classList.add('hidden');
document.getElementById('figure-modal').addEventListener('click', (e) => {
  if (e.target.id === 'figure-modal') e.target.classList.add('hidden');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.getElementById('figure-modal').classList.add('hidden');
});

['search', 'filter-mfr', 'filter-era', 'filter-collection'].forEach((id) => {
  document.getElementById(id).addEventListener('input', render);
});

fetch('data/figures.json')
  .then((r) => r.json())
  .then((d) => {
    DATA = d;
    const years = [...new Set(d.waves.map((w) => w.year))].sort((a, b) => a - b);
    document.getElementById('filter-era').innerHTML =
      '<option value="">All years</option>' + years.map((y) => `<option>${y}</option>`).join('');
    render();
  })
  .catch(() => {
    document.getElementById('timeline').innerHTML =
      '<p style="color:var(--muted)">Could not load <code>data/figures.json</code>.</p>';
  });
