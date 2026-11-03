#!/usr/bin/env python3
"""Check the generated pages: styles and UI strings the page uses exist, and, with playwright, every page opens without errors.

Usage: python3 generator/check_page.py    (run after build.py)

Static checks always run: every class written by page_logic.js has a rule in page_head.html, and every UI string
the page reads exists in the i18n file. If playwright is installed, it also opens dist/index.html and each
clients/<id>/dist/index.html, walks the tabs and an activity sheet, and fails on any page error.
Exit code 1 on any problem.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TPL = ROOT / "generator" / "templates"
problems = []

logic = (TPL / "page_logic.js").read_text(encoding="utf-8")
head = (TPL / "page_head.html").read_text(encoding="utf-8")
strings = json.loads((ROOT / "generator" / "i18n" / "es.json").read_text(encoding="utf-8"))

# Classes that only serve as hooks for scripts or labels, with no style of their own.
HOOKS = {"pdone", "pdays", "pcell", "msrow", "msg", "pblk", "pl", "num", "hd", "hs", "st", "sp", "rule", "ah", "arr"}


def class_values(src):
    """Text of every class="..." in a template string, as (static text, text inside ${...})."""
    for m in re.finditer(r'class="', src):
        i, depth, static, dynamic = m.end(), 0, [], []
        while i < len(src):
            if src.startswith("${", i): depth += 1; i += 2; static.append(" "); continue
            ch = src[i]
            if depth:
                depth += ch == "{"; depth -= ch == "}"; dynamic.append(ch); i += 1; continue
            if ch == '"': break
            static.append(ch); i += 1
        yield "".join(static), "".join(dynamic)


used = set()
for static, dynamic in class_values(logic):
    words = static.split() + [w for s in re.findall(r'"([^"$]*)"', dynamic) for w in s.split()]
    # A word ending in "-" is a prefix completed by an expression (st-ok, st-late); one letter is a counter (t0, t1).
    used |= {w for w in words if not w.endswith("-") and len(w) > 1 and re.fullmatch(r"[a-z][\w-]*", w)}
for c in sorted(used - HOOKS):
    if not re.search(r"\." + re.escape(c) + r"(?![\w-])", head):
        problems.append(f"page_logic.js uses class '{c}', which has no rule in page_head.html")
for k in sorted(set(re.findall(r"\bT\.([a-z_0-9]+)", logic)) | set(re.findall(r"\{\{t\.([a-zA-Z0-9_]+)\}\}", head))):
    if k not in strings: problems.append(f"UI string '{k}' is used but missing in generator/i18n/es.json")

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sync_playwright = None
    print("notice: playwright not installed; pages not opened")
if sync_playwright:
    pages = [ROOT / "dist" / "index.html"] + sorted((ROOT / "clients").glob("*/dist/index.html"))
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for page_path in pages:
            if not page_path.exists(): continue
            ctx = browser.new_context(); page = ctx.new_page(); errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.goto(page_path.as_uri())
            for tab in ["#tabRm", "#tabOv", "#tabDt", "#tabVr", "#tabIn", "#tabRn"]:
                page.click(tab)
            page.click("#tabOv")
            link = page.locator("#timeline [data-openact]")
            if link.count():
                link.first.click()
                if not page.locator("#detail .astep").count(): errors.append("activity sheet shows no steps")
            rel = page_path.relative_to(ROOT)
            problems += [f"{rel}: {e}" for e in errors]
            print(f"{rel}: {'ok' if not errors else str(len(errors)) + ' problem(s)'}")
            ctx.close()
        browser.close()

if problems:
    print("\n".join(problems)); print(f"\n{len(problems)} problem(s)."); sys.exit(1)
print("OK: styles and UI strings in place.")
