/* quest-exhibits.js — pure exhibition-commission helpers for Grail Quest 6.0.
   No DOM, no storage, no fetch: safe to import from quest.js (the board) and
   vault-room.js (drawer quest hints). All signals derive from the archive
   data and the caller's owned ids — nothing invented. */
import { buildBafs } from "./baf-planner.js";
import {
  baseName, runKey, characterRuns, shelfCommissions, activeCommissions,
  completedCommissions, grailScore, grailTier, GRAIL_TIER_LABELS,
} from "./quest-core.js";
import { KO_TARGETS } from "./ko-targets.js";

export { GRAIL_TIER_LABELS };

/* Commission accession numbers — the registrar numbers every commission. */
const KIND_CODES = { baf: "BAF", run: "RUN", character: "CHR", shelf: "SHF" };
export function commissionNo(kind, idx) {
  const code = KIND_CODES[kind] ?? "GEN";
  return `CQ-${code}-${String(idx + 1).padStart(2, "0")}`;
}

/* Which commissions are newly completed since the last celebration.
   `celebrated` is the stored { commissionId: isoDate } map; returns the ids
   that finished but were never celebrated — the ceremony queue. */
export function detectNewCompletions(celebrated, completedIds) {
  const seen = celebrated && typeof celebrated === "object" ? celebrated : {};
  return (Array.isArray(completedIds) ? completedIds : []).filter((id) => !(id in seen));
}

/* Known-KO-target matches among a figure list — the evergreen KO market,
   wired into quest difficulty where it is honest: a missing piece that is a
   documented KO target gets an authenticate-first flag. Token matching
   follows ko-targets.js (name-contains). */
export function koTargetsIn(figs) {
  const hits = [];
  for (const f of figs ?? []) {
    const name = String(f?.name ?? "").toLowerCase();
    for (const t of KO_TARGETS) {
      if (name.includes(t.match) && !hits.some((h) => h.match === t.match)) {
        hits.push(t);
      }
    }
  }
  return hits;
}

/* The drawer's commission story — for the Vault Room drawer dialog. Given
   one flat figure record and the flat archive, answer: is this drawer part
   of any started commission, and does pulling it complete one?
   Returns null when the figure starts no commission. */
export function drawerQuestHint(fig, figures, ownedIds) {
  const owned = new Set(Array.isArray(ownedIds) ? ownedIds : []);
  if (!fig || owned.has(fig.id)) {
    return owned.has(fig?.id)
      ? { text: "Already accessioned — it's hanging on your exhibit wall.", completes: false }
      : null;
  }
  const cands = [];

  /* BAF wing: figures in the same wave carrying BAF pieces. */
  if (fig.bafPiece && fig.waveBaf) {
    const waveFigs = (figures ?? []).filter((f) => f.waveId === fig.waveId && f.bafPiece);
    const pieces = new Map();
    for (const f of waveFigs) {
      if (!pieces.has(f.bafPiece)) pieces.set(f.bafPiece, []);
      pieces.get(f.bafPiece).push(f);
    }
    const got = [...pieces.values()].filter((carriers) =>
      carriers.some((c) => owned.has(c.id))
    ).length;
    const total = pieces.size;
    const mine = pieces.get(fig.bafPiece) ?? [];
    /* Only started BAFs — the quest board never issues an unstarted
       commission, and the drawer shouldn't either. */
    if (total && got > 0 && got < total && !mine.some((c) => owned.has(c.id))) {
      cands.push({
        kind: "baf", title: `Finish BAF: ${fig.waveBaf}`,
        got, total, missing: total - got,
        completes: total - got === 1,
      });
    }
  }

  /* Character run: the archive's base-name grouping, 5+ releases. */
  for (const r of characterRuns(figures, ownedIds, 5)) {
    if (r.name !== baseName(fig.name)) continue;
    if (r.got > 0 && r.got < r.total) {
      cands.push({
        kind: "character", title: `Close the gap: ${r.name} run`,
        got: r.got, total: r.total, missing: r.total - r.got,
        completes: r.total - r.got === 1,
      });
    }
  }

  /* Series run: numbered waves collapsed by runKey, 3+ figures. */
  const key = runKey(fig.waveSeries);
  if (key) {
    const group = (figures ?? []).filter((f) => runKey(f.waveSeries) === key);
    if (group.length >= 3) {
      const got = group.filter((f) => owned.has(f.id)).length;
      if (got > 0 && got < group.length) {
        cands.push({
          kind: "run", title: `Complete the ${key} run`,
          got, total: group.length, missing: group.length - got,
          completes: group.length - got === 1,
        });
      }
    }
  }

  /* Year shelf: the Vault Room shelf this drawer sits on. */
  for (const s of shelfCommissions(figures, ownedIds)) {
    if (s.year !== fig.year) continue;
    if (s.got > 0 && s.missingCount > 0) {
      cands.push({
        kind: "shelf", title: s.title,
        got: s.got, total: s.total, missing: s.missingCount,
        completes: s.missingCount === 1,
      });
    }
  }

  if (!cands.length) return null;
  cands.sort((a, b) => a.missing - b.missing || b.total - a.total);
  const c = cands[0];
  return {
    completes: c.completes,
    text: c.completes
      ? `Pull this drawer and the “${c.title}” commission is complete — ${c.got}/${c.total} hung.`
      : `One of ${c.missing} missing pieces for the “${c.title}” commission — ${c.got}/${c.total} hung so far.`,
  };
}

/* The growing exhibit: every commission with at least one owned piece,
   rendered as a wing with its hung pieces. Completed wings first, then by
   progress — the collection as a museum that fills in as you log figures. */
export function exhibitWings(figures, waves, ownedIds) {
  const owned = new Set(Array.isArray(ownedIds) ? ownedIds : []);
  const wings = [];

  const bafNameCounts = new Map();
  const allBafs = buildBafs(waves);
  for (const b of allBafs) bafNameCounts.set(b.name, (bafNameCounts.get(b.name) ?? 0) + 1);
  for (const baf of allBafs) {
    const hung = [];
    for (const p of baf.pieces) {
      const carrier = p.carriers.find((c) => owned.has(c.id));
      if (carrier) hung.push({ piece: p.piece, fig: carrier });
    }
    if (!hung.length) continue;
    /* Completed wings leave the wall for the permanent gallery. */
    if (hung.length === baf.pieces.length) continue;
    const name = bafNameCounts.get(baf.name) > 1 ? `${baf.name} (${baf.year})` : baf.name;
    wings.push({
      kind: "baf", id: `baf:${baf.name}:${baf.year}`,
      title: `Finish BAF: ${name}`, sub: `${baf.series} · ${baf.year}`,
      hung, total: baf.pieces.length,
    });
  }

  const runs = new Map();
  for (const f of figures ?? []) {
    const key = runKey(f.waveSeries);
    if (!key) continue;
    if (!runs.has(key)) runs.set(key, []);
    runs.get(key).push(f);
  }
  for (const [key, figs] of runs) {
    if (figs.length < 3) continue;
    const hung = figs.filter((f) => owned.has(f.id));
    if (!hung.length || hung.length === figs.length) continue;
    wings.push({
      kind: "run", id: `run:${key}`, title: `Complete the ${key} run`,
      sub: [...new Set(figs.map((f) => f.waveSeries))].join(" · "),
      hung: hung.map((f) => ({ piece: null, fig: f })), total: figs.length,
    });
  }

  for (const r of characterRuns(figures, ownedIds, 5)) {
    if (r.got === 0 || r.got === r.total) continue;
    wings.push({
      kind: "character", id: `character:${r.name}`,
      title: `Close the gap: ${r.name} run`,
      sub: `${r.figs.length} releases in the archive`,
      hung: r.figs.filter((f) => owned.has(f.id)).map((f) => ({ piece: null, fig: f })),
      total: r.figs.length,
    });
  }

  for (const s of shelfCommissions(figures, ownedIds)) {
    if (s.got === 0 || s.missingCount === 0) continue;
    wings.push({
      kind: "shelf", id: s.id, title: s.title, sub: s.sub,
      hung: (figures ?? [])
        .filter((f) => f.year === s.year && owned.has(f.id))
        .map((f) => ({ piece: null, fig: f })),
      total: s.total,
    });
  }

  wings.sort((a, b) =>
    (b.hung.length / b.total) - (a.hung.length / a.total) ||
    b.hung.length - a.hung.length
  );
  return wings;
}

export { activeCommissions, completedCommissions, grailScore, grailTier };
