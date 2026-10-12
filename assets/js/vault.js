/* vault.js — Collector's Vault identity behaviors (wave 33).
   Classic script, loaded with defer on every page (hand + generated).
   Reduced-motion-first: reveal + sheen only run when
   (a) the OS reports no-preference, and (b) the visitor hasn't set the
   manual reduce toggle (data-motion="reduce"). Still state is default. */
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

  /* --- Scroll reveals: [data-reveal] elements start finished; JS adds the
         hidden state only when motion is allowed, so no-JS/no-motion readers
         always see the content. --- */
  function initReveals() {
    if (!("IntersectionObserver" in window)) return;
    var targets = document.querySelectorAll(
      ".page-head, .stat, .card, .wave-baf-callout, .placard, .fig-list > .fig, .release-list > .release"
    );
    if (!targets.length) return;
    targets.forEach(function (el) { el.setAttribute("data-reveal", ""); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    // Stagger within each parent's group (multiples of 0.05s, capped).
    var groups = new Map();
    targets.forEach(function (el) {
      var key = el.parentNode;
      var n = groups.get(key) || 0;
      el.style.setProperty("--rd", Math.min(n * 0.05, 0.3).toFixed(2) + "s");
      groups.set(key, n + 1);
      io.observe(el);
    });
    // Elements already in view on load still animate in once.
  }

  /* --- Vitrine sheen: pointer-tracked glass highlight on placards/cards.
         rAF-throttled; touch pointers ignored; never runs under reduce. --- */
  function initSheen() {
    if (!window.matchMedia || !window.matchMedia("(pointer: fine)").matches) return;
    var pending = null;
    function onMove(ev) {
      var el = ev.currentTarget;
      if (pending) return;
      pending = requestAnimationFrame(function () {
        pending = null;
        if (!motionOK) return;
        var r = el.getBoundingClientRect();
        var x = ((ev.clientX - r.left) / r.width) * 100;
        var y = ((ev.clientY - r.top) / r.height) * 100;
        el.style.setProperty("--mx", x.toFixed(1) + "%");
        el.style.setProperty("--my", y.toFixed(1) + "%");
      });
    }
    Array.prototype.forEach.call(
      document.querySelectorAll(".stat, .placard, a.card.wave-card, a.card.char-card"),
      function (el) { el.addEventListener("pointermove", onMove, { passive: true }); }
    );
  }

  initToggle();
  if (syncMotionFlag()) {
    initReveals();
    initSheen();
  }
})();
