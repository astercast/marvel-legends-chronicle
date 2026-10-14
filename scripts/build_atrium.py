#!/usr/bin/env python3
"""Generate the homepage Contents roll call from scripts/nav_data.py.

The departments are the catalogue's Contents (MARVEL-LIGHT 3.2,
after Letterform Archive 1.7 and the counted index of Fonts In
Use 1.5): each department stands as ONE ruled line carrying its
name in display serif, a one-line scope note in Pencil, and its
population count at the right in Ink; its doors stand under the
line as ruled entries. The block is written between the
<!-- HALLS:BEGIN --> / <!-- HALLS:END --> markers in index.html,
so the editorial copy lives in exactly one place (nav_data.HALLS),
the same source that feeds the Index of Halls directory template.

(The dark build's specimen-drawer hall cards, with seals, pulls,
and marketing notes, are retired with the vault skin. The note
that R21 suppressed on the homepage band returns here in its
proper job: the contents line's scope note.)

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


def contents_entry(title, note, pages):
    links = "".join(
        f'<li><a href="{escape(href)}">'
        f'<span class="dir-page">{escape(label)}</span>'
        f'<span class="dir-blurb">{escape(blurb)}</span></a></li>'
        for href, label, blurb in pages
    )
    return f"""      <details class="contents-entry" name="halls">
        <summary class="contents-line">
          <span class="contents-name">{escape(title)}</span>
          <span class="contents-note">{escape(note)}</span>
          <span class="contents-count">{len(pages)}<span class="visually-hidden"> doors</span></span>
        </summary>
        <ul class="contents-pages">{links}
        </ul>
      </details>"""


def build():
    cards = "\n".join(
        contents_entry(title, note, pages)
        for title, note, pages in nav_data.HALLS
    )
    return f"""{BEGIN}
      <div class="contents-list">
{cards}
      </div>
      {END}"""


def main():
    path = ROOT / "index.html"
    text = path.read_text()
    if BEGIN not in text or END not in text:
        print("index.html has no HALLS markers, nothing to do")
        return
    new = RE.sub(lambda _: build(), text, count=1)
    if new != text:
        path.write_text(new)
        print("contents roll call regenerated in index.html")
    else:
        print("contents roll call unchanged")


if __name__ == "__main__":
    main()
