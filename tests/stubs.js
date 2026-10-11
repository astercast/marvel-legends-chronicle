/* Browser-environment stubs for Node tests.
   Lets us import the real site modules (which touch document/localStorage/
   fetch at import time) without a browser. Fake elements absorb all DOM
   operations; localStorage is an in-memory Map; fetch always 404s (every
   module's error path is expected to handle that). */
"use strict";

function makeEl() {
  const target = {
    dataset: {},
    style: {},
    classList: {
      add() {}, remove() {}, toggle() {}, contains() { return false; },
    },
  };
  return new Proxy(target, {
    get(t, p) {
      if (p === Symbol.toPrimitive) return () => "";
      if (p === "then") return undefined; // never thenable
      if (p in t) return t[p];
      switch (p) {
        case "querySelector": return () => makeEl();
        case "querySelectorAll": return () => [];
        case "getElementsByTagName": return () => [];
        case "getBoundingClientRect":
          return () => ({ top: 0, left: 0, width: 0, height: 0 });
        case "closest": return () => null;
        case "getAttribute": return () => null;
        case "addEventListener":
        case "removeEventListener":
        case "setAttribute":
        case "removeAttribute":
        case "focus":
        case "blur":
        case "click":
        case "remove":
        case "select":
        case "scrollIntoView":
          return () => {};
        case "appendChild":
        case "append":
        case "insertBefore":
        case "replaceChild":
          return (c) => c;
        default:
          return undefined;
      }
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

const __mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (__mem.has(k) ? __mem.get(k) : null),
  setItem: (k, v) => { __mem.set(k, String(v)); },
  removeItem: (k) => { __mem.delete(k); },
  clear: () => { __mem.clear(); },
  key: (i) => [...__mem.keys()][i] ?? null,
  get length() { return __mem.size; },
};
/* Test helper: reset storage between tests. */
globalThis.__resetStorage = () => { __mem.clear(); };

globalThis.document = {
  getElementById: () => makeEl(),
  createElement: () => makeEl(),
  createDocumentFragment: () => makeEl(),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
  body: makeEl(),
  activeElement: null,
  title: "",
};

globalThis.window = globalThis;
globalThis.confirm = () => false;
globalThis.alert = () => {};

/* Every module must survive a failed fetch — the stub 404s everything. */
globalThis.fetch = async () => ({
  ok: false,
  status: 404,
  statusText: "Not Found",
  json: async () => ({}),
  text: async () => "",
});

export { makeEl };
