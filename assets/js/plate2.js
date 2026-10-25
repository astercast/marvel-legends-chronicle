/* plate2.js: loads, fallbacks and the second chance for every .plate2 img.
   No framework, no observers, no per-image requests of our own. Native
   loading="lazy" decides when a photo is fetched; this only reacts. */
(function () {
  "use strict";
  var MIN_SIDE = 120; /* a shop's "image coming soon" gif or tracking pixel is not a photograph */

  function plateOf(img) { return img.closest ? img.closest(".plate2") : null; }

  function settle(img, ok) {
    var plate = plateOf(img);
    if (!plate) return;
    if (ok && (img.naturalWidth < MIN_SIDE || img.naturalHeight < MIN_SIDE)) ok = false;
    if (ok) {
      img.classList.add("is-in");
      plate.setAttribute("data-state", "ok");
      return;
    }
    /* second chance: the next source the manifest lists for this figure */
    var alts = (img.getAttribute("data-alts") || "").split(" ").filter(Boolean);
    if (alts.length) {
      img.setAttribute("data-alts", alts.slice(1).join(" "));
      img.removeAttribute("srcset");
      img.src = alts[0];
      return;
    }
    /* out of sources: drop the photo; the typographic floor is what remains */
    img.remove();
    plate.setAttribute("data-state", "dead");
    plate.dispatchEvent(new CustomEvent("plate-dead", { bubbles: true }));
  }

  function isPlateImg(t) { return t && t.nodeType === 1 && t.tagName === "IMG" && plateOf(t); }

  /* load and error do not bubble, so listen in the capture phase on document */
  document.addEventListener("load", function (e) { if (isPlateImg(e.target)) settle(e.target, true); }, true);
  document.addEventListener("error", function (e) { if (isPlateImg(e.target)) settle(e.target, false); }, true);

  /* images that finished (or failed) before this script ran */
  function sweep(root) {
    (root || document).querySelectorAll(".plate2 img").forEach(function (img) {
      if (img.complete && !img.classList.contains("is-in")) settle(img, img.naturalWidth > 0);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { sweep(); });
  else sweep();
  window.plate2Sweep = sweep; /* for plates the page adds later */
})();
