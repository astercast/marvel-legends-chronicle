/* lib/github.js — shared GitHub Contents API helper (marvel-legends-chronicle).
 * Canonical copy per ARCHITECTURE.md §1.11. Copy verbatim between repos;
 * do not fork behavior.
 *
 * The repo is the database (§5): cron jobs read/write versioned JSON via the
 * Contents API and functions serve the committed bytes.
 *
 * Env: GITHUB_REPO_TOKEN (fine-grained PAT, contents:write on this repo only),
 *      GITHUB_REPO ("owner/name"), REPO_STATIC_PREFIX ("site/" or ""),
 *      GITHUB_BRANCH (default "main").
 *
 * ---- PENDING TOKEN (open decision 1, 2026-10-11) ----
 * The fine-grained PAT for commit-back is still pending the user's decision.
 * Until GITHUB_REPO_TOKEN is configured, writeJsonIfChanged() degrades
 * gracefully: it returns { committed: false, reason: "no-token" } instead of
 * throwing, and callers run READ-ONLY (compute fresh data, return it in the
 * response envelope, persist nothing). Nothing is faked and nothing is lost:
 * the next wave's push (or the wave engine) still owns the static files.
 * readJson() still attempts the call — it works unauthenticated for public
 * repos; for private repos it will 404 and the caller falls back to the
 * deployment bundle.
 *
 * readJson(repoPath) -> Promise<{ data, sha }>
 * writeJsonIfChanged(repoPath, obj, message)
 *   -> Promise<{ committed, changed, sha, reason }>
 *      committed=true  -> sha of the new commit blob
 *      committed=false, changed=false -> content identical, no commit
 *      committed=false, reason='conflict' -> SHA race lost twice; next run picks it up
 *      committed=false, reason='no-token' -> read-only degradation (see above)
 *
 * Canonical bytes: 2-space indent + trailing newline (matches the repo's
 * existing writers, e.g. scripts/refresh/check_radar.py). Comparison is
 * semantic (stable key-sorted stringify of both sides) so a formatting-only
 * difference never triggers a commit.
 */
"use strict";

const { fetchTimeout, DEFAULT_UA } = require("./fetchx");

const GH_TIMEOUT_MS = 8000;

function repo() {
  return process.env.GITHUB_REPO || "";
}
function prefix() {
  const p = process.env.REPO_STATIC_PREFIX || "";
  return p && !p.endsWith("/") ? p + "/" : p;
}
function branch() {
  return process.env.GITHUB_BRANCH || "main";
}
function token() {
  return process.env.GITHUB_REPO_TOKEN || "";
}

function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const keys = Object.keys(v).sort();
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + stableStringify(v[k])).join(",") +
    "}"
  );
}

function canonicalText(obj) {
  return JSON.stringify(obj, null, 2) + "\n";
}

async function gh(path) {
  const url = "https://api.github.com" + path;
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token()) headers.Authorization = "Bearer " + token();
  // GET only — PUT has its own path below (ghPut) with the same timeout.
  return fetchTimeout(url, { timeoutMs: GH_TIMEOUT_MS, headers, ua: DEFAULT_UA });
}

// fetchx is GET-only; PUT needs its own small path with the same timeout.
async function ghPut(path, bodyObj) {
  const url = "https://api.github.com" + path;
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    "User-Agent": DEFAULT_UA,
  };
  if (token()) headers.Authorization = "Bearer " + token();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GH_TIMEOUT_MS);
  const start = Date.now();
  try {
    const r = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(bodyObj),
      signal: ctrl.signal,
    });
    const ms = Date.now() - start;
    clearTimeout(timer);
    let data = null;
    try {
      data = await r.json();
    } catch (e) {
      data = null;
    }
    return { ok: r.status >= 200 && r.status < 300, status: r.status, data, ms };
  } catch (e) {
    clearTimeout(timer);
    const reason =
      e && e.name === "AbortError" ? `timeout after ${GH_TIMEOUT_MS}ms` : String((e && e.message) || e);
    return { ok: false, status: 0, data: null, ms: Date.now() - start, error: reason };
  }
}

function contentsPath(repoPath) {
  const full = (prefix() + repoPath).replace(/^\/+/, "");
  return (
    "/repos/" + repo() + "/contents/" + full.split("/").map(encodeURIComponent).join("/")
  );
}

async function readJson(repoPath) {
  if (!repo()) throw new Error("GITHUB_REPO is not configured");
  const qp = `?ref=${encodeURIComponent(branch())}`;
  const r = await gh(contentsPath(repoPath) + qp);
  if (!r || !r.ok) {
    const detail = r ? `http ${r.status}${r.error ? ": " + r.error : ""}` : "request failed";
    throw new Error(`github readJson ${repoPath}: ${detail}`);
  }
  let payload;
  try {
    payload = JSON.parse(r.text);
  } catch (e) {
    throw new Error(`github readJson ${repoPath}: bad JSON from API`);
  }
  if (payload.type !== "file" || typeof payload.content !== "string") {
    throw new Error(`github readJson ${repoPath}: not a file`);
  }
  const text = Buffer.from(payload.content, "base64").toString("utf8");
  return { data: JSON.parse(text), sha: payload.sha };
}

async function writeJsonIfChanged(repoPath, obj, message) {
  // Graceful read-only degradation while the commit-back PAT is pending.
  if (!token()) {
    return { committed: false, changed: null, sha: null, reason: "no-token" };
  }
  if (!repo()) {
    return { committed: false, changed: null, sha: null, reason: "no-repo" };
  }

  let current = null;
  try {
    current = await readJson(repoPath);
  } catch (e) {
    if (!/http 404/.test(String((e && e.message) || e))) throw e;
    current = null; // file does not exist yet -> create it
  }

  const want = stableStringify(obj);
  if (current && stableStringify(current.data) === want) {
    return { committed: false, changed: false, sha: current.sha, reason: null };
  }

  const body = {
    message,
    content: Buffer.from(canonicalText(obj), "utf8").toString("base64"),
  };
  if (current && current.sha) body.sha = current.sha;

  const putPath = contentsPath(repoPath);
  let attempt = await ghPut(putPath, body);
  if (!attempt.ok && attempt.status === 409 && current) {
    // SHA race: re-read once, re-compare, retry once (§4.3).
    try {
      const fresh = await readJson(repoPath);
      if (stableStringify(fresh.data) === want) {
        return { committed: false, changed: false, sha: fresh.sha, reason: null };
      }
      body.sha = fresh.sha;
      attempt = await ghPut(putPath, body);
    } catch (e) {
      return { committed: false, changed: null, sha: null, reason: "conflict" };
    }
  }
  if (!attempt.ok) {
    if (attempt.status === 409) {
      return { committed: false, changed: null, sha: null, reason: "conflict" };
    }
    throw new Error(
      `github write ${repoPath}: http ${attempt.status}${attempt.error ? ": " + attempt.error : ""}`
    );
  }
  const newSha =
    attempt.data && attempt.data.content && attempt.data.content.sha
      ? attempt.data.content.sha
      : null;
  return { committed: true, changed: true, sha: newSha, reason: null };
}

module.exports = {
  readJson,
  writeJsonIfChanged,
  stableStringify,
  canonicalText,
  GH_TIMEOUT_MS,
};
