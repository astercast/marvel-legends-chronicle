/* R23 shared state: Owned / Wanted in browser-local storage.
   Standing keys mlc_owned_v1 / mlc_wanted_v1 stored census ids; R23 stores
   the figure slug (derived from the id) under the same keys' successor names
   and migrates any standing marks on first load. Slugs are the only form
   that ever reaches the page. */
export function slugify(id){ return String(id).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }
const NEW={owned:"mlc_owned_r23",wanted:"mlc_wanted_r23"};
const OLD={owned:"mlc_owned_v1",wanted:"mlc_wanted_v1"};
export function loadSet(kind){
  try{
    const raw=localStorage.getItem(NEW[kind]);
    if(raw) return new Set(JSON.parse(raw));
    const old=JSON.parse(localStorage.getItem(OLD[kind])||"[]");
    const s=new Set(old.map(slugify)); saveSet(kind,s); return s;
  }catch{ return new Set(); }
}
export function saveSet(kind,set){ try{ localStorage.setItem(NEW[kind],JSON.stringify([...set])); }catch{} }
export function esc(s){ return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
export function stateButtons(slug){
  const o=loadSet("owned").has(slug), w=loadSet("wanted").has(slug);
  return `<div class="state">
    <button class="statebtn" data-state="owned" data-slug="${esc(slug)}" aria-pressed="${o}">Owned</button>
    <button class="statebtn" data-state="wanted" data-slug="${esc(slug)}" aria-pressed="${w}">Wanted</button></div>`;
}
export function wireState(root, onChange){
  root.addEventListener("click", e=>{
    const b=e.target.closest("[data-state]"); if(!b) return;
    const set=loadSet(b.dataset.state);
    if(set.has(b.dataset.slug)) set.delete(b.dataset.slug); else set.add(b.dataset.slug);
    saveSet(b.dataset.state,set);
    root.querySelectorAll(`[data-state="${b.dataset.state}"][data-slug="${CSS.escape(b.dataset.slug)}"]`)
      .forEach(x=>x.setAttribute("aria-pressed", set.has(b.dataset.slug)));
    if(onChange) onChange();
  });
}
export async function getJSON(url){ const r=await fetch(url); if(!r.ok) throw new Error(url); return r.json(); }
/* Designed load-failure treatment: a photograph that cannot load is replaced
   by a typographic plate naming the figure and pointing at the source.
   It is never a broken-image box and never a substitute image. */
export function guardImages(root=document){
  root.addEventListener("error", e=>{
    const t=e.target;
    if(!(t instanceof HTMLImageElement) || t.dataset.guarded) return;
    if(t.closest && t.closest(".plate2")) return; /* plate2.js owns plate failures: alt second chance, then the floor */
    t.dataset.guarded="1";
    const alt=t.getAttribute("alt")||"";
    if(t.classList.contains("thumb")){
      const s=document.createElement("span"); s.className="notpic"; s.textContent="Picture at source";
      t.replaceWith(s);
    } else {
      const d=document.createElement("div"); d.className="notplate";
      d.innerHTML=`<div class="np-name"></div><p class="micro">Picture at source · photograph did not load</p>`;
      d.querySelector(".np-name").textContent=alt.replace(/ figure photograph$/,"");
      t.closest(".plate") ? t.closest(".plate").replaceChildren(d) : t.replaceWith(d);
    }
  }, true);
}
