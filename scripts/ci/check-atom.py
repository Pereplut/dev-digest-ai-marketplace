#!/usr/bin/env python3
"""CI (SITE-SPEC AC-9): feed.xml is well-formed Atom 1.0 with the elements RFC 4287 requires.

    python3 scripts/ci/check-atom.py site/dist/feed.xml
"""
import sys
import xml.etree.ElementTree as ET
from datetime import datetime

A = "{http://www.w3.org/2005/Atom}"


def problems(path):
    root = ET.parse(path).getroot()
    out = []
    if root.tag != f"{A}feed":
        return [f"root element is {root.tag}, expected Atom <feed>"]
    for tag in ("id", "title", "updated"):
        if root.find(f"{A}{tag}") is None:
            out.append(f"feed: missing <{tag}>")
    if root.find(f"{A}author") is None and any(e.find(f"{A}author") is None for e in root.findall(f"{A}entry")):
        out.append("feed: no <author> on the feed or on every entry")
    ids = set()
    for i, entry in enumerate(root.findall(f"{A}entry"), 1):
        for tag in ("id", "title", "updated"):
            if entry.find(f"{A}{tag}") is None:
                out.append(f"entry {i}: missing <{tag}>")
        eid = entry.findtext(f"{A}id")
        if eid in ids:
            out.append(f"entry {i}: duplicate id {eid}")
        ids.add(eid)
    for el in root.iter(f"{A}updated"):
        try:
            datetime.fromisoformat(el.text.replace("Z", "+00:00"))
        except (TypeError, ValueError):
            out.append(f"<updated> is not RFC 3339: {el.text!r}")
    return out


if __name__ == "__main__":
    found = problems(sys.argv[1])
    for p in found:
        print(f"  x {p}", file=sys.stderr)
    entries = len(ET.parse(sys.argv[1]).getroot().findall(f"{A}entry"))
    print(f"atom: {'FAILED' if found else 'ok'} ({entries} entries)")
    sys.exit(1 if found else 0)
