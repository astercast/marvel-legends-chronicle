/* 2026-review.html: month-scrubber enhancement.
 * The scrubber is plain anchor links and works without JS. This adds:
 *  - smooth scrolling that respects prefers-reduced-motion
 *  - scroll-spy: the scrubber link for the month in view gets aria-current
 */
(function () {
  "use strict";

  var scrubber = document.getElementById("yr-scrubber");
  if (!scrubber) return;

  var links = Array.prototype.slice.call(scrubber.querySelectorAll("a[data-month]"));
  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  links.forEach(function (a) {
    a.addEventListener("click", function (ev) {
      var target = document.getElementById("month-" + a.getAttribute("data-month"));
      if (!target) return;
      ev.preventDefault();
      if (reduceMotion || !target.scrollIntoView) {
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
        window.location.hash = "month-" + a.getAttribute("data-month");
      } else {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", "#month-" + a.getAttribute("data-month"));
      }
    });
  });

  function setCurrent(month) {
    links.forEach(function (a) {
      if (a.getAttribute("data-month") === month) {
        a.setAttribute("aria-current", "true");
      } else {
        a.removeAttribute("aria-current");
      }
    });
  }

  var sections = links
    .map(function (a) { return document.getElementById("month-" + a.getAttribute("data-month")); })
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          setCurrent(en.target.id.replace(/^month-/, ""));
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    sections.forEach(function (s) { io.observe(s); });
  }
})();
