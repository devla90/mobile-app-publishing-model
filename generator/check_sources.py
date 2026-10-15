#!/usr/bin/env python3
"""Detect changes in the official pages cited in docs/validation.md.

Usage:
  python3 generator/check_sources.py            # compare with generator/sources_hash.json
  python3 generator/check_sources.py --update   # store current hashes as the reference

Hashes the visible text of each page (tags and whitespace stripped) and compares it
with the stored hash. A change means "review the row with /validate-requirements",
not that the data point changed. Exit code 1 when there are changes or errors.
"""
import hashlib, html, json, re, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOC = ROOT / "docs" / "validation.md"
REF = ROOT / "generator" / "sources_hash.json"
UA = {"User-Agent": "Mozilla/5.0 (source checker; mobile-app-publishing-model)"}


def urls_in_doc():
    text = DOC.read_text(encoding="utf-8")
    seen, out = set(), []
    for u in re.findall(r"https?://[^\s|)>\]]+", text):
        u = u.rstrip(".,")
        if u not in seen:
            seen.add(u); out.append(u)
    return out


def visible_text(body: str) -> str:
    body = re.sub(r"(?is)<(script|style|noscript).*?</\1>", " ", body)
    body = re.sub(r"(?s)<[^>]+>", " ", body)
    return re.sub(r"\s+", "", html.unescape(body))


def hash_url(u: str):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30) as r:
            return hashlib.sha256(visible_text(r.read().decode("utf-8", "ignore")).encode()).hexdigest(), None
    except Exception as e:  # noqa: BLE001
        return None, str(e)


def main():
    update = "--update" in sys.argv
    ref = json.loads(REF.read_text()) if REF.exists() else {}
    current, changed, errors, unknown = {}, [], [], []
    for u in urls_in_doc():
        h, err = hash_url(u)
        if err:
            errors.append((u, err)); continue
        current[u] = h
        if u not in ref:
            unknown.append(u)
        elif ref[u] != h:
            changed.append(u)
    if update:
        REF.write_text(json.dumps(current, indent=1) + "\n")
        print(f"Reference stored: {len(current)} sources.")
        return 0
    print(f"Sources checked: {len(current) + len(errors)}")
    for u in changed: print(f"CHANGED  {u}")
    for u in unknown: print(f"NO REF   {u}")
    for u, e in errors: print(f"ERROR    {u}  ({e})")
    if not (changed or errors or unknown):
        print("No changes.")
    return 1 if (changed or errors) else 0


if __name__ == "__main__":
    sys.exit(main())
