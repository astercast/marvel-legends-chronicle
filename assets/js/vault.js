/* vault.js, the catalogue's shared behaviors.
   Classic script, loaded with defer on every page (hand + generated).
   Under the light system the motion estate is the seal press and
   hover transitions only: the scroll reveals and the vitrine sheen
   of the dark build are REMOVED (their CSS went with them; nothing
   here hides, reveals, or gleams). What remains: the manual motion
   toggle (which gates the few transitions left) and the Index of
   Halls directory. Still state is the default everywhere. */
(function () {
  "use strict";

  var root = document.documentElement;
  var MOTION_KEY = "mlc_motion_v1";
  var motionOK = false;

  function storedPref() {
    try {
      return localStorage.getItem(MOTION_KEY) || "auto";
    } catch (e) {
      return "auto";
    }
  }

  function osPrefersReduced() {
    return window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function syncMotionFlag() {
    motionOK = !osPrefersReduced() && root.getAttribute("data-motion") !== "reduce";
    if (motionOK) {
      root.classList.add("vault-motion");
    } else {
      root.classList.remove("vault-motion");
    }
    return motionOK;
  }

  /* --- Manual motion control (footer .motion-toggle, injected by nav builders) --- */
  function syncToggleButtons() {
    var reducing = root.getAttribute("data-motion") === "reduce";
    Array.prototype.forEach.call(document.querySelectorAll(".motion-toggle"), function (btn) {
      btn.setAttribute("aria-pressed", reducing ? "true" : "false");
      var state = btn.querySelector(".motion-toggle-state");
      if (state) state.textContent = reducing ? "On" : "Off";
    });
  }

  function applyPref(pref) {
    if (pref === "reduce") {
      root.setAttribute("data-motion", "reduce");
    } else {
      root.removeAttribute("data-motion");
    }
    try {
      localStorage.setItem(MOTION_KEY, pref);
    } catch (e) { /* private mode: the toggle still works for this visit */ }
    syncMotionFlag();
    syncToggleButtons();
  }

  function initToggle() {
    applyPref(storedPref());
    Array.prototype.forEach.call(document.querySelectorAll(".motion-toggle"), function (btn) {
      btn.addEventListener("click", function () {
        var reducing = root.getAttribute("data-motion") === "reduce";
        applyPref(reducing ? "auto" : "reduce");
      });
    });
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", syncMotionFlag);
      }
    }
  }

  /* --- Index of Halls: the directory button opens the full 44-page
         index (a static <template> in every page) inside the shared modal.
         The modal module is dynamically imported so vault.js stays a
         dependency-free classic script. --- */
  function initDirectory() {
    var btn = document.getElementById("directory-button");
    var tpl = document.getElementById("directory-panel");
    if (!btn || !tpl || !("content" in tpl)) return;
    var src = (document.currentScript && document.currentScript.src) || "";
    var base = src.slice(0, src.lastIndexOf("/") + 1);
    btn.addEventListener("click", function () {
      import(base + "modal.js").then(function (m) {
        var frag = tpl.content.cloneNode(true);
        m.openModal(function (title, body) {
          title.textContent = "Index of Halls";
          body.classList.add("dir-body");
          body.appendChild(frag);
        });
      }).catch(function () {
        /* Module import failed (very old browser): fall back to the footer
           registry, which lists every page with no JS at all. */
        var footer = document.querySelector(".site-footer nav");
        if (footer) footer.scrollIntoView({ block: "start" });
      });
    });
  }

  initToggle();
  initDirectory();
  syncMotionFlag();
})();
