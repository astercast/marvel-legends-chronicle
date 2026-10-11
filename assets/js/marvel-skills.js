/* Marvel skills browser — loads skills/index.json, groups by category, live filter. */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var els = {
    filter: document.getElementById("skills-filter"),
    count: document.getElementById("skills-count"),
    list: document.getElementById("skills-list"),
    empty: document.getElementById("skills-empty")
  };
  if (!els.list) return;

  var all = [];
  var CAT_NAMES = {
    baf: "BAF completion checklists", characters: "Character collector guides",
    grails: "Grail dossiers", bootleg: "Bootleg & authentication",
    eras: "Era guides", collection: "Collection management",
    marketplace: "Marketplace guides", community: "Community",
    variants: "Variant guides", hunts: "Hunt procedures"
  };

  function catOf(path) { return path.split("/")[1]; }

  function render(q) {
    q = (q || "").trim().toLowerCase();
    var shown = all.filter(function (s) {
      return !q || (s.title + " " + s.description + " " + s.id).toLowerCase().indexOf(q) !== -1;
    });
    var groups = {};
    shown.forEach(function (s) {
      var c = catOf(s.path);
      (groups[c] = groups[c] || []).push(s);
    });
    els.list.innerHTML = Object.keys(groups).sort().map(function (c) {
      var cards = groups[c].map(function (s) {
        return '<article class="card skill-card">' +
          "<h3>" + esc(s.title) + "</h3>" +
          "<p>" + esc(s.description) + "</p>" +
          '<p class="skill-id"><code>' + esc(s.id) + "</code></p>" +
          "</article>";
      }).join("");
      return '<section class="skills-cat"><h2>' + esc(CAT_NAMES[c] || c) +
        ' <span class="count">(' + groups[c].length + ")</span></h2>" +
        '<div class="skills-cards">' + cards + "</div></section>";
    }).join("");
    els.empty.hidden = shown.length > 0;
    els.count.textContent = shown.length + " of " + all.length + " skills";
  }

  fetch("skills/index.json")
    .then(function (r) { if (!r.ok) throw new Error("skills index failed"); return r.json(); })
    .then(function (idx) {
      all = idx.skills || [];
      render("");
      var deb;
      els.filter.addEventListener("input", function () {
        clearTimeout(deb);
        deb = setTimeout(function () { render(els.filter.value); }, 150);
      });
    })
    .catch(function () {
      els.list.innerHTML = '<div class="empty-state"><p>Could not load the skills index.</p></div>';
    });
})();
