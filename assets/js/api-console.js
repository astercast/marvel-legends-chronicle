/* api-console.js — "Try the API" console on api.html.
   Page-specific: fetches api/v1/index.json for the endpoint list, then
   fetches + pretty-prints the chosen endpoint. All failures are graceful:
   file:// fetches fail in some browsers, so the error path says exactly
   what to do instead. */
"use strict";

(function () {
  var MAX_LINES = 2000;
  var form = document.getElementById("api-console-form");
  var picker = document.getElementById("api-endpoint");
  var fetchBtn = document.getElementById("api-fetch");
  var copyBtn = document.getElementById("api-copy");
  var status = document.getElementById("api-status");
  var code = document.getElementById("api-output-code");
  if (!form || !picker || !code) return; // not on api.html

  var rawJson = "";
  var endpoints = [];

  // Fallback list if the manifest itself can't be fetched (offline/file errors).
  var FALLBACK = [
    { name: "index", path: "api/v1/index.json" },
    { name: "stats", path: "api/v1/stats.json" },
    { name: "waves", path: "api/v1/waves.json" },
    { name: "figures", path: "api/v1/figures.json" },
    { name: "encyclopedia", path: "api/v1/encyclopedia.json" },
    { name: "preorders", path: "api/v1/preorders.json" },
    { name: "characters", path: "api/v1/characters.json" }
  ];

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function highlight(json) {
    return esc(json).replace(
      /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d+)?([eE][+-]?\d+)?/g,
      function (m, str, _e, colon, bool) {
        var cls = "tok-num";
        if (str) cls = colon ? "tok-key" : "tok-str";
        else if (bool) cls = bool === "null" ? "tok-nul" : "tok-bool";
        return '<span class="' + cls + '">' + m + "</span>";
      }
    );
  }

  function setStatus(msg) {
    status.textContent = msg;
  }

  function fillPicker(list) {
    picker.innerHTML = "";
    list.forEach(function (e) {
      var opt = document.createElement("option");
      opt.value = e.path;
      opt.textContent = e.path + " — " + (e.records != null ? e.records + " record" + (e.records === 1 ? "" : "s") : "");
      picker.appendChild(opt);
    });
  }

  function loadManifest() {
    fetch("api/v1/index.json")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (manifest) {
        endpoints = Object.keys(manifest.endpoints || {}).map(function (name) {
          var e = manifest.endpoints[name];
          return { name: name, path: e.path, records: e.records };
        });
        if (!endpoints.length) throw new Error("empty manifest");
        fillPicker(endpoints);
        setStatus("Endpoint list loaded from api/v1/index.json.");
      })
      .catch(function () {
        endpoints = FALLBACK;
        fillPicker(endpoints);
        setStatus("Could not load the manifest — showing a built-in endpoint list. Serve the site over HTTP for live data.");
      });
  }

  function fetchEndpoint(path) {
    setStatus("Fetching " + path + " …");
    fetchBtn.disabled = true;
    copyBtn.disabled = true;
    fetch(path)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (text) {
        var data = JSON.parse(text);
        rawJson = JSON.stringify(data, null, 2);
        var lines = rawJson.split("\n");
        var shown = lines.slice(0, MAX_LINES).join("\n");
        var note = lines.length > MAX_LINES
          ? "\n… (" + (lines.length - MAX_LINES).toLocaleString() + " more lines truncated — full payload is " +
            (text.length / 1024).toFixed(0) + " KB)"
          : "";
        code.innerHTML = highlight(shown) + (note ? esc(note) : "");
        var count = Array.isArray(data) ? data.length + " records" : "object";
        setStatus(path + " — " + count + ", " + (text.length / 1024).toFixed(1) + " KB, " +
          lines.length.toLocaleString() + " lines" +
          (lines.length > MAX_LINES ? " (truncated at " + MAX_LINES.toLocaleString() + ")" : "") + ".");
        copyBtn.disabled = false;
      })
      .catch(function (err) {
        code.textContent = "Fetch failed: " + (err && err.message ? err.message : err);
        setStatus("Could not fetch " + path + ". If this page was opened as a file, serve the site over HTTP (e.g. python3 -m http.server) and try again.");
      })
      .then(function () {
        fetchBtn.disabled = false;
      });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (picker.value) fetchEndpoint(picker.value);
  });

  copyBtn.addEventListener("click", function () {
    if (!rawJson) return;
    var done = function () { setStatus("JSON copied to clipboard."); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(rawJson).then(done, function () {
        setStatus("Copy failed — select the output and copy manually.");
      });
    } else {
      setStatus("Clipboard unavailable — select the output and copy manually.");
    }
  });

  loadManifest();
})();
