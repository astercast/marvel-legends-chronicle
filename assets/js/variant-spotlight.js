/* Variant spotlight — 15 of the most interesting documented variants.
   "why" and "spot" are written strictly from archive records (variant trait,
   notes, exclusive channel, wave/year) + the encyclopedia's variant taxonomy.
   Nothing is invented; coverage is stated honestly (15 of 83). */
import { loadData } from "./data.js";
import { escapeHtml } from "./figure-dialog.js";

const SPOTLIGHT = [
  {
    name: "Doombot", waveSeries: "Series 2", year: 2002,
    why: "The archive flags this as a chase-style variant of Doctor Doom — the early-2000s chase hunt in miniature. It is a distinct Doombot release filed under the Doom name, not a Doom repaint.",
    spot: "Check the variant taxonomy's chase & case-ratio section: chase-style pieces shipped short-packed in variant cases. Confirm the Doombot identity specifically — a standard Doctor Doom is not this figure.",
  },
  {
    name: "Hulk", waveSeries: "Series 1", year: 2002, trait: "Straight fingers, white shirt",
    why: "One of the very first documented variants in the line (Series 1, 2002), and it lived two lives: the standard-assortment variant plus a separate Walmart-exclusive release of the same deco.",
    spot: "The documented deco tells are straight fingers and a white shirt — compare against the standard Series 1 Hulk. The Walmart-exclusive release shares the deco, so channel alone doesn't identify it; the deco does.",
  },
  {
    name: "Iron Man", waveSeries: "Series 1", year: 2002, trait: "Gold Model 2 (horned) version",
    why: "A Series 1 variant that changes both deco and sculpt read: gold armor on the horned Model 2 body. Early Toy Biz loved packing two Iron Man variants into the debut wave.",
    spot: "Look for the gold deco on the horned Model 2 sculpt — the archive distinguishes it from the separate Series 1 'Stealth armor' Iron Man variant, so match both the color and the horned head.",
  },
  {
    name: "Iron Man", waveSeries: "Series 1", year: 2002, trait: "Stealth armor",
    why: "The other Series 1 Iron Man variant — stealth (dark) armor deco. It also resurfaced as a Walmart-exclusive listing, a common Toy Biz pattern of re-releasing a variant through a retailer channel.",
    spot: "Dark stealth deco on the Series 1 body. Don't confuse it with the gold Model 2 variant from the same wave — same character, same wave, completely different deco.",
  },
  {
    name: "Thing", waveSeries: "Series 2", year: 2002, trait: "Trenchcoat and sunglasses",
    why: "A sculpt-addition variant rather than a repaint: the trenchcoat and sunglasses turn the standard Thing into the classic incognito look. Toy Biz's variant playbook wasn't just deco swaps.",
    spot: "Check for the added sculpt pieces — trenchcoat and sunglasses — per the taxonomy's sculpt-variant category. A plain Thing from Series 2 is the regular release.",
  },
  {
    name: "Wolverine", waveSeries: "Series 3", year: 2002, trait: "Unmasked",
    why: "The unmasked head-sculpt variant that proved popular enough to be re-released in Series 6 (2004) — one of the few variants the archive shows crossing waves years apart.",
    spot: "Unmasked head sculpt is the tell. If the seller claims Series 3 original vs Series 6 re-release, the wave/packaging (not the figure alone) is what distinguishes them — the archive records both.",
  },
  {
    name: "Human Torch", waveSeries: "Series 2", year: 2002, trait: "No \"4\" on chest",
    why: "A deco-omission variant: the chest emblem simply isn't there. The subtlest kind of variant — easy to miss, which is exactly why it's on this list.",
    spot: "Look at the chest: no '4' emblem. Compare directly against the standard Series 2 Human Torch, which carries the emblem. This is a pure deco variant per the taxonomy.",
  },
  {
    name: "Ghost Rider", waveSeries: "Series 7", year: 2004, trait: "Phasing (translucent, flaming motorcycle)",
    why: "The phasing gimmick at full scale: translucent figure plus a flaming motorcycle. Series 7 ran a phasing theme — Vision got the same translucent treatment in the same wave.",
    spot: "Translucent plastic is the tell, plus the flaming motorcycle accessory. The regular Series 7 Ghost Rider is opaque — hold it to the light and there's no ambiguity.",
  },
  {
    name: "Jean Grey", waveSeries: "Series 6", year: 2004, trait: "Dark Phoenix",
    why: "The variant as alternate identity: Dark Phoenix deco on the Jean Grey body. Same wave also gave us the Series 3 Wolverine unmasked re-release — Series 6 was variant-heavy.",
    spot: "Dark Phoenix deco vs the standard Jean Grey from Series 6. The archive files it as a straight variant — match the deco, not the character name.",
  },
  {
    name: "Storm", waveSeries: "Series 8", year: 2004, trait: "Mohawk",
    why: "The mohawk sculpt marks this as the punk-era Storm — a sculpt variant with real character significance, from the same Series 8 that gave us the Earth-616 Captain America variant.",
    spot: "The mohawk head sculpt is unmistakable. Per the taxonomy's sculpt category, this is a head-swap variant — the body matches the standard Storm.",
  },
  {
    name: "X-23", waveSeries: "Series 12 - Apocalypse", year: 2005, trait: "Purple costume, wavy hair",
    why: "The variant that wasn't: announced as a variant but, per the archive's own note, shipped in greater numbers in non-variant cases. A case study in why 'variant' doesn't always mean 'rare' — check the chase & case-ratio guide.",
    spot: "Purple costume and wavy hair are the documented traits. But heed the archive note: this one is not actually scarce, whatever the variant label implies.",
  },
  {
    name: "Wasp", waveSeries: "Series 15 - MODOK", year: 2006, trait: "Blue costume",
    why: "The archive calls this one 'extremely rare' outright — the blue-costume Wasp against the standard red-costume, shoulder-length-hair version from the same Series 15. The genuine article of this list.",
    spot: "Blue costume vs the standard red. Given the rarity note, treat any listing with extra skepticism and run the auth wizard — rare variants attract convincing fakes.",
  },
  {
    name: "Destroyer", waveSeries: "Series 15 - MODOK", year: 2006, trait: "Variant of Thorbuster Iron Man",
    why: "The archive's note says it plainly: 'Entirely different character as variant.' The Destroyer shipped as the variant slot of the Thorbuster Iron Man figure — the strangest variant definition in the line.",
    spot: "You're looking for the Destroyer figure filed as a variant of Thorbuster Iron Man in Series 15. If the listing just says 'Destroyer,' confirm the wave — that's what makes it the variant.",
  },
  {
    name: "Sentry", waveSeries: "Giant-Man (Walmart Exclusive)", year: 2006, trait: "Bearded, long hair",
    why: "A variant with a job: the bearded, long-haired Sentry was required to complete the Giant-Man Build-A-Figure, and the archive records tan-costume variants (clean-shaven and bearded) in the same exclusive wave. Variant hunting meets BAF math.",
    spot: "Bearded with long hair, from the Walmart-exclusive Giant-Man wave — and check which BAF piece it carries, since completing Giant-Man is the reason this variant matters.",
  },
  {
    name: "Captain America", waveSeries: "Series 8", year: 2004, trait: "Earth-616 version",
    why: "The variant as continuity statement: the Earth-616 version against the regular Series 8 Cap. Toy Biz used variants to serve two continuities from one slot.",
    spot: "The archive files the 616 deco as the variant — compare against the standard Series 8 Captain America. The variant trait, not the shield, is the identifier.",
  },
];

async function init() {
  const list = document.getElementById("spot-list");
  try {
    const { waves } = await loadData();
    const cards = [];
    for (const [i, s] of SPOTLIGHT.entries()) {
      const wave = waves.find((w) => w.series === s.waveSeries && w.year === s.year);
      const fig = wave?.figures?.find(
        (f) => f.name === s.name && (!s.trait || f.variant === s.trait)
      );
      const trait = s.trait ?? fig?.variant ?? "";
      const meta = wave
        ? `${wave.series} (${wave.year}) · <span class="badge ${wave.manufacturer === "Toy Biz" ? "badge-toybiz" : ""}">${escapeHtml(wave.manufacturer)}</span>${fig?.exclusive ? ` · <span class="badge">${escapeHtml(fig.exclusive)}</span>` : ""}`
        : `${escapeHtml(s.waveSeries)} (${s.year})`;
      const waveLink = wave ? `<p class="spot-meta"><a href="waves/${wave.id}.html">View the full ${escapeHtml(wave.series)} wave →</a></p>` : "";
      cards.push(`
        <article class="card spot-card" aria-labelledby="spot-${i}">
          <div class="spot-head">
            <span class="spot-num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
            <h2 class="spot-name" id="spot-${i}">${escapeHtml(s.name)}</h2>
          </div>
          ${trait ? `<div class="spot-trait"><span class="badge badge-variant">${escapeHtml(trait)}</span></div>` : ""}
          <p class="spot-meta">${meta}</p>
          <div class="spot-sec">
            <h3>Why it matters</h3>
            <p>${escapeHtml(s.why)}</p>
          </div>
          <div class="spot-sec">
            <h3>How to spot it</h3>
            <p>${escapeHtml(s.spot)}</p>
          </div>
          ${waveLink}
        </article>`);
    }
    list.innerHTML = cards.join("");
  } catch (err) {
    console.error(err);
    list.innerHTML = `<div class="card" style="padding:var(--space-5)"><p>Could not load the figure database. Check your connection and reload.</p></div>`;
  }
}

init();
