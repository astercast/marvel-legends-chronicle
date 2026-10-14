/* Shared constants */
export const PATHS = {
  figures: "data/figures.json",
  encyclopedia: "data/encyclopedia.json",
  communitySeed: "data/community.json",
  preorders: "data/preorders.json",
  priceSignals: "data/price-signals.json",
  questMarket: "data/quest-market.json",
  compare: "data/v1/compare.json", // VS-mode profiles: deep links, rarity/price/KO cross-refs, upgrade paths
};

export const STORE_KEYS = {
  owned: "mlc_owned_v1",
  wanted: "mlc_wanted_v1",
  watching: "mlc_watching_v1", // [figId], figures the collector is keeping an eye on; My Vault's third shelf (Owned clears it, Wanted leaves it)
  social: "mlc_social_v1", // { profile, posts, likes, follows, comments }
  journal: "mlc_journal_v1", // [{ id, figId, name, condition, price, date, url, note }]
  buys: "mlc_buys_v1", // [{ id, figId, name, wave, condition, price, date, where, note }], purchases the user made
  watchlist: "mlc_watchlist_v1", // [{ id, figId, name, wave, target, note, created, sightings: [{id, date, where, price, sold, url, note}] }]
  shelfHistory: "mlc_shelf_history_v1", // [{ d: "YYYY-MM-DD", owned, wanted, bafDone }], snapshots for the growth trend
  exploreSeed: "mlc_explore_seed_v1", // integer seed for the explorer's shuffle
  exploreSeen: "mlc_explore_seen_v1", // [figId], figures already surfaced by "Surprise me"
  showcase: "mlc_showcase_v1", // { order: [figId], notes: { figId: text } }, the top-10 Shelfie Showcase
  gallery: "mlc_gallery_v1", // { shelves: [{ id, name, layout, photos: [{ id, dataUrl, caption, tags: [figId], ts }] }] }, Shelf Gallery photos (client-side only)
  hunt: "mlc_hunt_v1", // { selected: [figId], maxPrices: { figId: number } }, toy-show hunt planner
  preorders: "mlc_preorders_v1", // { <preorderItemId>: "watching"|"ordered"|"skipped" }, pre-order tracker personal calls
  budget: "mlc_budget_v1", // { monthly: number|null, annual: number|null }, the user's own spend targets
  launchPrep: "mlc_launchprep_v1", // { <questId>: [bool] }, launch-day prep checklist ticks
  questDone: "mlc_quest_done_v1", // { <commissionId>: "YYYY-MM-DD" }, commissions already celebrated, so the ceremony fires once
  dropweek: "mlc_dropweek_v1", // { <dropId>: { <figName>: "want"|"ordered" } }, Drop Week battle plan
  dropweekChecklist: "mlc_dropweek_checklist_v1", // { <checklistItemId>: true }, Drop Week buyer checklist ticks
  dropweekPrices: "mlc_dropweek_prices_v1", // [{ id, figure, kind: "asking"|"sold", price, where, date, note }], the user's own Drop Week price sightings, lanes never mixed
  dropweekCapture: "mlc_dropweek_capture_v1", // { listings: [{ id, figure, retailer, price, observedAt, note }], sellouts: [{ id, figure, retailer, observedAt, note }] }, the user's own drop-day capture log: asking listings and sellout events in separate lanes
  motion: "mlc_motion_v1", // "reduce"|"auto", manual motion preference for the vault identity (wave 33)
};

export const MARKETPLACES = [
  { id: "ebay", label: "eBay", url: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}` },
  { id: "amazon", label: "Amazon", url: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}` },
  { id: "bbts", label: "BigBadToyStore", url: (q) => `https://www.bigbadtoystore.com/Search?SearchText=${encodeURIComponent(q)}` },
  { id: "pulse", label: "Hasbro Pulse", url: (q) => `https://hasbropulse.com/search?q=${encodeURIComponent(q)}` },
];
