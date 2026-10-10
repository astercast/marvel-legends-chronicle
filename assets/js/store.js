/* Versioned localStorage store with corruption recovery.
   All reads go through load(); corrupt or foreign data resets to the default
   and logs a warning instead of crashing the page. */
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return structuredClone(fallback);
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? structuredClone(fallback) : parsed;
  } catch (err) {
    console.warn(`[store] corrupt data for ${key}, resetting`, err);
    try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
    return structuredClone(fallback);
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[store] could not save ${key}`, err);
    return false;
  }
}

/* A set of figure ids persisted as an array in localStorage. */
export function makeIdSet(key) {
  const read = () => new Set(load(key, []));
  return {
    has: (id) => read().has(id),
    toggle: (id) => {
      const set = read();
      set.has(id) ? set.delete(id) : set.add(id);
      save(key, [...set]);
      return set.has(id);
    },
    all: () => [...read()],
    count: () => read().size,
  };
}
