#!/usr/bin/env python3
"""Generate the homepage "Choose a hall" section from scripts/nav_data.py.

The halls (specimen-drawer <details> cards) are written between the
<!-- HALLS:BEGIN --> / <!-- HALLS:END --> markers in index.html, so the
editorial blurbs live in exactly one place (nav_data.HALLS) — the same
source that feeds the Index of Halls directory template.

Usage: python3 scripts/build_atrium.py
Idempotent: the marked block is rebuilt from scratch each run.
"""
import re
import sys
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import nav_data  # noqa: E402

BEGIN = "<!-- HALLS:BEGIN -->"
END = "<!-- HALLS:END -->"
RE = re.compile(re.escape(BEGIN) + r".*?" + re.escape(END), re.S)


def hall_card(i, title, note, pages):  # note unused on the homepage band since R21: hall names stand in department voice, engraved caps, no sentence under them (the note still runs in the Index of Halls directory)
    links = "".join(
        f'<li><a href="{escape(href)}">'
        f'<span class="dir-page">{escape(label)}</span>'
        f'<span class="dir-blurb">{escape(blurb)}</span></a></li>'
        for href, label, blurb in pages
    )
    seal = escape(title.split()[1][0] if len(title.split()) > 1 else title[0])
    return f"""      <details class="hall" name="halls">
        <summary>
          <span class="hall-seal" aria-hidden="true">{seal}</span>
          <span><span class="hall-title">{escape(title)}</span></span>
          <span class="hall-pull" aria-hidden="true">+</span>
        </summary>
        <ul class="hall-pages">{links}
        </ul>
      </details>"""


def build():
    cards = "\n".join(
        hall_card(i, title, note, pages)
        for i, (title, note, pages) in enumerate(nav_data.HALLS)
    )
    return f"""{BEGIN}
      <div class="hall-grid">
{cards}
      </div>
      {END}"""


def main():
    path = ROOT / "index.html"
    text = path.read_text()
    if BEGIN not in text or END not in text:
        print("index.html has no HALLS markers — nothing to do")
        return
    new = RE.sub(lambda _: build(), text, count=1)
    if new != text:
        path.write_text(new)
        print("halls section regenerated in index.html")
    else:
        print("halls section unchanged")


if __name__ == "__main__":
    main()
