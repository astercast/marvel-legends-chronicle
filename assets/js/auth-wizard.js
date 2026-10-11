/* Bootleg authentication wizard — step-by-step pass/fail flow with verdict.
   Checks derived from the encyclopedia bootleg guide + counterfeit-market research.
   Vanilla JS, keyboard-navigable, reduced-motion safe. */
(function () {
  "use strict";

  var STEPS = [
    {
      id: "packaging",
      title: "Step 1 — Packaging",
      intro: "Knockoffs fail at the card first. Compare against a known-authentic photo if you can.",
      checks: [
        { id: "pkg-print", q: "Is the card/box printing crisp, with correct colors and logos?",
          hint: "Fail: blurry printing, off-color logos, flimsy cardstock, thin or cloudy blisters." },
        { id: "pkg-marks", q: "Are the Hasbro/Marvel markings and legal text present?",
          hint: "Fail: missing manufacturer marks, missing legal text, or a brand never named in the description." },
        { id: "pkg-era", q: "Does the packaging match the figure's era?",
          hint: "Clamshell+comic = Toy Biz (2002–2006); window box = 2014+; printed-image box = 2022–23 windowless era; retro card = 2022–23 homage, NOT vintage. A mismatch is a repack/bootleg red flag." },
      ],
    },
    {
      id: "paint",
      title: "Step 2 — Paint & sculpt",
      intro: "Authentic Legends have crisp, consistent deco throughout.",
      checks: [
        { id: "paint-clean", q: "Is the paint clean — no rough edges, slop, or missing applications?",
          hint: "Fail: sloppy or missing paint, rough edges, wrong accessory details." },
        { id: "paint-sculpt", q: "Are the parts well-formed with no misshapen pieces?",
          hint: "Fail: misshapen parts, soft detail, parts that don't match reference photos." },
      ],
    },
    {
      id: "joints",
      title: "Step 3 — Joints",
      intro: "Joints are the fingerprint: KOs differ at the pegs.",
      checks: [
        { id: "joint-pegs", q: "Do the neck ball peg, elbow/knee pegs, and hand pegs match the authentic design?",
          hint: "Fail: peg shapes differ from reference photos — the most reliable KO tell." },
        { id: "joint-gaps", q: "Are there no unexplained gaps at the elbows and knees?",
          hint: "Fail: visible gaps at elbows/knees. Example: the KO Carnage is also betrayed by silver eyes vs. authentic paint." },
      ],
    },
    {
      id: "listing",
      title: "Step 4 — Listing & seller",
      intro: "Bootlegs cluster at impossible prices from familiar seller patterns.",
      checks: [
        { id: "list-photos", q: "Does the listing show real photos of the actual figure?",
          hint: "Fail: stock photos only, or 'no box' offered on a supposedly mint exclusive." },
        { id: "list-seller", q: "Is the seller pattern clean?",
          hint: "Fail: seller in China/Hong Kong with $10–40 pricing on a $25+ figure. Also beware near-genuine pricing on SE Asia marketplaces (e.g. Shopee) — KOs priced like genuine are fraud, not deals." },
      ],
    },
    {
      id: "price",
      title: "Step 5 — Price logic",
      intro: "The market is the lie detector.",
      checks: [
        { id: "price-sane", q: "Is the price within reach of 90-day eBay SOLD listings for the same condition?",
          hint: "Fail: 40%+ under 90-day solds — assume bootleg until proven otherwise. Asking prices are wishes; only solds count." },
      ],
    },
  ];

  var answers = {}; // checkId -> "pass" | "fail" | "skip"
  var stepIndex = 0;
  var root = document.getElementById("wizard");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function totalChecks() {
    return STEPS.reduce(function (n, s) { return n + s.checks.length; }, 0);
  }

  function answeredCount() {
    return Object.keys(answers).length;
  }

  function renderProgress() {
    var total = totalChecks();
    var done = answeredCount();
    var pct = total ? Math.round((done / total) * 100) : 0;
    return (
      '<div class="wizard-progress" role="progressbar" aria-valuenow="' + done +
      '" aria-valuemin="0" aria-valuemax="' + total + '" aria-label="Authentication progress">' +
      '<span style="width:' + pct + '%"></span></div>' +
      '<p class="wizard-step-label">Check ' + done + ' of ' + total + '</p>'
    );
  }

  function answerBtn(check, value, label) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-sm" + (answers[check.id] === value ? " btn-gold" : "");
    b.textContent = label;
    b.setAttribute("aria-pressed", answers[check.id] === value ? "true" : "false");
    b.addEventListener("click", function () {
      answers[check.id] = value;
      render();
      // move focus to the next unanswered check for keyboard flow
      var cards = root.querySelectorAll(".check-card");
      for (var i = 0; i < cards.length; i++) {
        if (!cards[i].classList.contains("answered-pass") &&
            !cards[i].classList.contains("answered-fail") &&
            !cards[i].hasAttribute("data-skipped")) {
          var first = cards[i].querySelector("button");
          if (first) { first.focus(); break; }
        }
      }
    });
    return b;
  }

  function renderStep() {
    var step = STEPS[stepIndex];
    root.innerHTML = renderProgress();

    var h = document.createElement("h2");
    h.style.fontSize = "1.3rem";
    h.textContent = step.title;
    root.appendChild(h);
    var intro = document.createElement("p");
    intro.style.cssText = "color:var(--muted);font-size:0.92rem;margin-bottom:var(--space-4);";
    intro.textContent = step.intro;
    root.appendChild(intro);

    step.checks.forEach(function (check) {
      var card = document.createElement("div");
      card.className = "check-card";
      var a = answers[check.id];
      if (a === "pass") card.classList.add("answered-pass");
      if (a === "fail") card.classList.add("answered-fail");
      if (a === "skip") card.setAttribute("data-skipped", "true");
      var q = document.createElement("p");
      q.className = "check-q";
      q.textContent = check.q;
      var hint = document.createElement("p");
      hint.className = "check-hint";
      hint.textContent = check.hint;
      var row = document.createElement("div");
      row.className = "btn-row";
      row.appendChild(answerBtn(check, "pass", "✓ Pass"));
      row.appendChild(answerBtn(check, "fail", "✗ Fail"));
      row.appendChild(answerBtn(check, "skip", "Skip"));
      card.appendChild(q);
      card.appendChild(hint);
      card.appendChild(row);
      root.appendChild(card);
    });

    var nav = document.createElement("div");
    nav.className = "btn-row";
    nav.style.marginTop = "var(--space-5)";
    if (stepIndex > 0) {
      var back = document.createElement("button");
      back.type = "button";
      back.className = "btn";
      back.textContent = "← Back";
      back.addEventListener("click", function () { stepIndex--; render(); });
      nav.appendChild(back);
    }
    var next = document.createElement("button");
    next.type = "button";
    next.className = "btn btn-primary";
    next.textContent = stepIndex === STEPS.length - 1 ? "See the verdict →" : "Next →";
    next.addEventListener("click", function () {
      if (stepIndex === STEPS.length - 1) renderVerdict();
      else { stepIndex++; render(); }
    });
    nav.appendChild(next);
    var restart = document.createElement("button");
    restart.type = "button";
    restart.className = "btn btn-ghost";
    restart.textContent = "Restart";
    restart.addEventListener("click", function () { answers = {}; stepIndex = 0; render(); });
    nav.appendChild(restart);
    root.appendChild(nav);
  }

  function renderVerdict() {
    var fails = [];
    var skips = 0;
    STEPS.forEach(function (step) {
      step.checks.forEach(function (check) {
        var a = answers[check.id];
        if (a === "fail") fails.push(check);
        else if (a !== "pass") skips++;
      });
    });

    var cls, title, body;
    if (fails.length >= 2) {
      cls = "verdict-fail";
      title = "Likely bootleg — walk away";
      body = "Two or more corroborating fails. No matter the price, pass: another listing always comes.";
    } else if (fails.length === 1) {
      cls = "verdict-warn";
      title = "Inconclusive — investigate";
      body = "One fail doesn't convict, but don't buy until the flagged check is resolved with better photos or a second opinion.";
    } else {
      cls = "verdict-auth";
      title = "Likely authentic";
      body = "Every answered check passed." + (skips ? " " + skips + " check" + (skips === 1 ? "" : "s") + " skipped — the verdict is only as strong as the checks you answered." : " Run the 90-day sold price check before paying.");
    }

    root.innerHTML = renderProgress();
    var card = document.createElement("div");
    card.className = "card verdict " + cls;
    var failedList = fails.length
      ? "<ul>" + fails.map(function (c) { return "<li><strong>" + esc(c.q) + "</strong><br>" + esc(c.hint) + "</li>"; }).join("") + "</ul>"
      : "";
    card.innerHTML =
      "<h2>" + esc(title) + "</h2><p style='color:var(--ink-dim);'>" + esc(body) + "</p>" + failedList +
      '<div class="btn-row" style="justify-content:center;">' +
      '<a class="btn btn-sm" href="encyclopedia.html#bootlegs">Bootleg guide</a>' +
      '<a class="btn btn-sm" href="price-guide.html">Price methodology</a>' +
      '<button class="btn btn-sm btn-ghost" id="wiz-restart" type="button">Run it again</button></div>';
    root.appendChild(card);
    document.getElementById("wiz-restart").addEventListener("click", function () {
      answers = {}; stepIndex = 0; render();
    });
    card.querySelector("h2").setAttribute("tabindex", "-1");
    card.querySelector("h2").focus();
  }

  function render() { renderStep(); }
  render();
})();
