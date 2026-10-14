/* "Copy my quest" export, the shareable quest-card text shared by Grail Quest
   and the Showcase. Pure function: every number comes from the caller's
   tracker/archive data; nothing is invented.
   input: {
     level: { title, level (0-based), xp },
     ownedCount, archiveCount (may be null), completedBafs,
     achievements: [{ unlocked, ... }],
     quests: [{ title, got, total }],
     latestAchievement: { icon, name } | null,
     recs: { baf, cheapPiece, grail } | null   // from recommendNext()
   } */
export function buildQuestShareText({
  level, ownedCount, archiveCount, completedBafs, achievements,
  quests, latestAchievement, recs,
}) {
  const ach = Array.isArray(achievements) ? achievements : [];
  const lines = [
    `🏆 My Marvel Legends Grail Quest, ${level.title} (Level ${level.level + 1}, ${level.xp} XP)`,
  ];
  let progress = `${ownedCount} figures owned`;
  if (archiveCount && archiveCount > 0) {
    const pct = Math.round((ownedCount / archiveCount) * 100);
    progress += ` (${pct}% of the ${archiveCount.toLocaleString("en-US")}-figure archive)`;
  }
  progress += ` · ${completedBafs} BAF${completedBafs === 1 ? "" : "s"} completed`;
  progress += ` · ${ach.filter((a) => a.unlocked).length}/${ach.length} achievements`;
  lines.push(`⭐ ${progress}`);

  const top = (Array.isArray(quests) ? quests : []).slice(0, 3);
  if (top.length) {
    lines.push("🎯 Active quests:");
    for (const q of top) lines.push(`• ${q.title} (${q.got}/${q.total})`);
  }

  if (recs) {
    const next = [];
    if (recs.baf) {
      next.push(`Closest BAF: ${recs.baf.title}, ${recs.baf.missingCount} to go`);
    }
    if (recs.cheapPiece) {
      next.push(`Cheapest gap-fill: ${recs.cheapPiece.fig.name} (fills: ${recs.cheapPiece.quest.title})`);
    }
    if (recs.grail) {
      const name = recs.grail.entry.name ?? "watchlist item";
      const price = recs.grail.price != null ? `, reported as low as $${recs.grail.price}` : "";
      next.push(`Watchlist grail: ${name}${price}`);
    }
    if (next.length) {
      lines.push("🔜 Next quests:");
      for (const n of next) lines.push(`• ${n}`);
    }
  }

  if (latestAchievement) {
    lines.push(`🎖️ Latest achievement: ${latestAchievement.icon} ${latestAchievement.name}`);
  }
  lines.push("Tracked with the Marvel Legends Chronicle, Grail Quest.");
  return lines.join("\n");
}
