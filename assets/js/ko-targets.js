/* Known KO targets — editorial research notes, drawn ONLY from the archive's
   own authentication research (data/encyclopedia.json bootlegGuide and the
   2026 Holiday Guide's KO coverage). Used to annotate Gift Finder picks with
   honest "authenticate first" warnings. Every entry cites its source; a
   target is never guessed. Matching is token-based on the figure name so
   e.g. "Cyclops (X-Men '97)" matches the documented X-Men '97 Cyclops KO. */

export const KO_TARGETS = [
  {
    match: "dragon man",
    note: "Known KO target — buy at retail or run the Auth Wizard before paying.",
    source: "Encyclopedia bootleg guide",
  },
  {
    match: "ronan",
    note: "Known KO target — buy at retail or run the Auth Wizard before paying.",
    source: "Encyclopedia bootleg guide",
  },
  {
    match: "juggernaut",
    note: "Juggernaut BAF recast is a known KO target — verify the piece before buying.",
    source: "Encyclopedia bootleg guide",
  },
  {
    match: "carnage",
    note: "KO tell documented: silver eyes on the fake. Compare before buying.",
    source: "Encyclopedia bootleg guide",
  },
  {
    match: "maximum spider-man",
    note: "Maximum Series Spider-Man KO reviewed in video (Apr 2026) — retail or Hasbro Pulse only.",
    source: "2026 Holiday Guide",
  },
  {
    match: "x-men '97 cyclops",
    note: "X-Men '97 Cyclops KO (Mustang Toyz) reviewed in video (Sep 2026) — retail or Hasbro Pulse only.",
    source: "2026 Holiday Guide",
  },
];

/* Tokens of a target that must ALL appear in the figure name. */
function tokens(s) {
  return String(s ?? "").toLowerCase().split(/[^a-z0-9']+/).filter((t) => t.length >= 2);
}

/* koNoteFor(name) -> { note, source } | null. Exported for tests. */
export function koNoteFor(name) {
  const nameToks = new Set(tokens(name));
  if (!nameToks.size) return null;
  for (const t of KO_TARGETS) {
    const need = tokens(t.match);
    if (need.length && need.every((tok) => nameToks.has(tok))) {
      return { note: t.note, source: t.source };
    }
  }
  return null;
}
