"""One plate for every figure picture (assets/css/plate2.css, assets/js/plate2.js).
Static twin of plate2() in assets/js/figure-images.js. Both read the same
manifest fields: imageUrl, imageSource, sourceUrl, alts[], w, h, fit, matte, status."""
import re
from html import escape
from urllib.parse import quote

HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
FITS = {"fill", "box", "square"}


def usable(entry):
    """A manifest entry that may be shown: has a URL and was not marked dead."""
    return bool(entry) and bool(entry.get("imageUrl")) and entry.get("status") != "dead"


def _alts(entry):
    out = []
    for a in entry.get("alts") or []:
        u = a.get("imageUrl", "")
        if u.startswith("https://"):
            out.append(quote(u, safe=":/?&=%._-~"))   # no spaces: the attribute is space-separated
    return " ".join(out)


def credit_line(entry):
    # Round-3 credited wording kept ("Photo at <shop>"), per the owner's
    # mechanism gate for the 2026-10-24 bundle: Claude's plate2 draft said
    # "Photo: <shop>"; the wording already live on the site wins.
    return f'Photo at {entry["imageSource"]}'


def plate2(entry, name, href, *, thumb=False, eager=False, vt=None, tag="a"):
    """The plate. With no usable entry it is the typographic floor alone."""
    n = escape(name)
    floor = f'<span class="p-floor"><span class="p-name">{n}</span><span class="p-micro">Not pictured</span></span>'
    cls = "plate2" + (" is-thumb" if thumb else "")
    vts = f' style="view-transition-name:{vt}"' if vt else ""
    if not usable(entry):
        h0 = f' href="{escape(href)}"' if tag == "a" else ""
        return f'<{tag} class="{cls}" data-state="none"{h0}{vts}>{floor}</{tag}>'
    fit = entry.get("fit") if entry.get("fit") in FITS else ""
    matte = entry.get("matte") if HEX.match(entry.get("matte") or "") else ""
    style = f' style="--matte:{matte}"' if matte else ""
    if vt: style = style[:-1] + f';view-transition-name:{vt}"' if style else vts
    w, h = int(entry.get("w") or 345), int(entry.get("h") or 460)
    alts = _alts(entry)
    img = (f'<img src="{escape(entry["imageUrl"], quote=True)}" alt="{n} figure photograph" '
           f'width="{w}" height="{h}" decoding="async" referrerpolicy="no-referrer"'
           + ('' if eager else ' loading="lazy"') + (' fetchpriority="high"' if eager else '')
           + (f' data-alts="{escape(alts, quote=True)}"' if alts else "") + '>')
    credit = "" if thumb else f'<span class="p-credit">{escape(credit_line(entry))}</span>'
    h0 = f' href="{escape(href)}"' if tag == "a" else ""
    return (f'<{tag} class="{cls}" data-state="wait"' + (f' data-fit="{fit}"' if fit else "") + f'{style}{h0}>'
            f'{floor}{img}{credit}</{tag}>')
