/* Shared constants */
export const PATHS = {
  figures: "data/figures.json",
  encyclopedia: "data/encyclopedia.json",
  communitySeed: "data/community.json",
};

export const STORE_KEYS = {
  owned: "mlc_owned_v1",
  wanted: "mlc_wanted_v1",
  social: "mlc_social_v1", // { profile, posts, likes, follows, comments }
  journal: "mlc_journal_v1", // [{ id, figId, name, condition, price, date, url, note }]
  buys: "mlc_buys_v1", // [{ id, figId, name, wave, condition, price, date, where, note }] — purchases the user made
  watchlist: "mlc_watchlist_v1", // [{ id, figId, name, wave, target, note, created, sightings: [{id, date, where, price, sold, url, note}] }]
  shelfHistory: "mlc_shelf_history_v1", // [{ d: "YYYY-MM-DD", owned, wanted, bafDone }] — snapshots for the growth trend
};

export const MARKETPLACES = [
  { id: "ebay", label: "eBay", url: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}` },
  { id: "amazon", label: "Amazon", url: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}` },
  { id: "bbts", label: "BigBadToyStore", url: (q) => `https://www.bigbadtoystore.com/Search?SearchText=${encodeURIComponent(q)}` },
  { id: "pulse", label: "Hasbro Pulse", url: (q) => `https://hasbropulse.com/search?q=${encodeURIComponent(q)}` },
];
