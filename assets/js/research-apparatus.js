/* research-apparatus.js: the one-per-page research apparatus on
   character register pages (R21, L13 fix).

   At HEAD the register repeated the same Research disclosure block
   verbatim under every figure (54 times on the Captain America
   page): three external search links plus an explanatory note.
   The note now prints once per page, in the apparatus, and the
   per-figure links are generated here, on interaction, from the
   clicked row's own data (its name and variant), using the same
   URL patterns assets/js/listings.js has always used. No prices
   are scraped and no reviews are invented; these are searches. */
(function () {
  var apparatus = document.getElementById("research-apparatus");
  if (!apparatus) return;
  var target = apparatus.querySelector(".research-target");
  var list = apparatus.querySelector(".research-links");
  if (!target || !list) return;

  function linksFor(name, variant) {
    var q = ["Marvel Legends", name, variant].filter(Boolean).join(" ");
    return [
      ["eBay sold listings", "https://www.ebay.com/sch/i.html?_nkw=" + encodeURIComponent(q).replace(/%20/g, "+") + "&LH_Sold=1&LH_Complete=1"],
      ["YouTube reviews", "https://www.youtube.com/results?search_query=" + encodeURIComponent(q + " review").replace(/%20/g, "+")],
      ["Web search", "https://www.google.com/search?q=" + encodeURIComponent(q).replace(/%20/g, "+")],
    ];
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest(".research-btn") : null;
    if (!btn) return;
    var name = btn.getAttribute("data-name") || "";
    var variant = btn.getAttribute("data-variant") || "";
    target.innerHTML = "";
    var span = document.createElement("span");
    span.className = "research-for";
    span.textContent = "Research for " + name + (variant ? " (" + variant + ")" : "") + ":";
    target.appendChild(span);
    list.innerHTML = "";
    linksFor(name, variant).forEach(function (pair) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = pair[1];
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = pair[0];
      li.appendChild(a);
      list.appendChild(li);
    });
  });
})();
