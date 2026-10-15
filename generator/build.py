#!/usr/bin/env python3
"""Build dist/ from model/*.json, clients/*/instance.json and generator/i18n/<lang>.json.

Outputs in dist/:
  index.html                  interactive explorer of the base model (state kept in the browser)
  swimlanes.svg / .png        swimlane diagram of the base model
  clients/<id>/index.html, swimlanes.svg, swimlanes.png   the same, instantiated per client
  diff-<id>.md                what each client changes relative to the base

Usage:  python3 generator/build.py [--no-png] [--lang es]
Requires Python 3.10+. PNG export needs playwright (pip install playwright && playwright install chromium);
if it is missing, the PNG is skipped with a notice.
"""
import json, sys, html, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
MODEL = ROOT / "model"
TEMPLATES = ROOT / "generator" / "templates"
I18N = ROOT / "generator" / "i18n"
OUT = ROOT / "dist"
NO_PNG = "--no-png" in sys.argv
LANG = sys.argv[sys.argv.index("--lang") + 1] if "--lang" in sys.argv else "es"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_model():
    g = lambda n: read_json(MODEL / n)
    act, cred, art, var, pha, stp, dia, ren, mil = (g(n) for n in [
        "actors.json", "credentials.json", "artifacts.json", "variants.json", "phases.json",
        "steps.json", "diagram.json", "renewals.json", "milestones.json"])
    m = {}
    m["A"] = {k: v["name"] for k, v in act["roles"].items()}
    m["LANES"] = [[c["id"], c["name"], c["description"], c["roles"]] for c in act["lanes"]]
    m["PAIRS"] = [[*p["roles"], p["risk"], p["severity"]] for p in act["incompatible_pairs"]]
    m["C"] = {k: [v["name"], v["validity"]] for k, v in cred["items"].items()}
    m["F"] = {k: [v["name"], v["format"]] for k, v in art["items"].items()}
    m["V"] = {k: [v["name"], [f'{o["key"]}) {o["text"]}' for o in v["options"]]] for k, v in var["items"].items()}
    m["FREQ"] = pha["frequencies"]
    m["PH"] = [[f["id"], f["name"], f["frequency"]] for f in pha["phases"]]
    m["TIME"] = {f["id"]: [f["duration"]["min"], f["duration"]["max"], f["duration"]["depends_on"]] for f in pha["phases"]}
    m["STAGES"] = [[e["name"], e["phases"]] for e in pha["stages"]]
    m["VER_PH"] = pha["per_version_phases"]
    m["S_RAW"] = [[p["id"], p["name"], p["platform"], p["owner"], p["inputs"], p["outputs"],
                   p["depends_on"], ",".join(p["variants"]), p.get("note", "")] for p in stp["steps"]]
    m["BOX"] = [[a["n"], a["lane"], a["stage"], a["lines"], a["phases"]] for a in dia["activities"]]
    m["REN"] = [[r["id"], r["name"], r["group"], r["cycle_months"], r["lead_days"], r["if_expired"], r["renewed_by"], r["step"]] for r in ren["items"]]
    m["MS"] = [[h["id"], h["name"], h["description"], h["phases"], [[c["id"], c["text"], c["step"]] for c in h["checks"]]] for h in mil["milestones"]]
    return m


def load_strings(lang):
    path = I18N / f"{lang}.json"
    if not path.exists():
        sys.exit(f"No UI strings for language '{lang}' (expected {path.relative_to(ROOT)})")
    return read_json(path)


def fill(template, t):
    """Replace {{t.key}} placeholders with strings from the i18n file."""
    def sub(mt):
        key = mt.group(1)
        if key not in t:
            sys.exit(f"Missing UI string: {key}")
        return t[key]
    return re.sub(r"\{\{t\.([a-zA-Z0-9_]+)\}\}", sub, template)


def tf(t, key, **vars):
    s = t[key]
    for k, v in vars.items():
        s = s.replace("{" + k + "}", str(v))
    return s


def js_data(m, t, instance=None):
    d = lambda v: json.dumps(v, ensure_ascii=False)
    s = [f"const T={d(t)};"]
    s.append(f'const A={d(m["A"])};')
    s.append(f'const C={d(m["C"])};')
    s.append(f'const F={d(m["F"])};')
    s.append(f'const V={d(m["V"])};')
    s.append(f'const LANES={d(m["LANES"])};')
    s.append('const laneOfRole=Object.fromEntries(LANES.flatMap(l=>l[3].map(a=>[a,l[0]])));')
    s.append('const laneName=id=>{const l=LANES.find(x=>x[0]===id);return l?l[1]:""};')
    s.append(f'const PH={d(m["PH"])};')
    s.append(f'const FREQ={d(m["FREQ"])};')
    s.append(f'const S={d(m["S_RAW"])}.map(r=>({{id:r[0],name:r[1],plat:r[2],resp:r[3],inp:r[4],out:r[5],deps:r[6],vars:r[7]?r[7].split(","):[],note:r[8]||"",ph:r[0].split(".")[0]}}));')
    s.append('const byId=Object.fromEntries(S.map(s=>[s.id,s]));S.forEach(s=>s.enables=[]);S.forEach(s=>s.deps.forEach(d=>byId[d]&&byId[d].enables.push(s.id)));')
    s.append('const roleIds=s=>[...new Set((s.resp.match(/A\\d\\d/g)||[]))];const order=S.map(s=>s.id);')
    s.append('const lanesOf=s=>[...new Set(roleIds(s).map(a=>laneOfRole[a]))];const leadLane=s=>laneOfRole[roleIds(s)[0]];')
    s.append(f'const STAGES={d(m["STAGES"])};')
    s.append(f'const BOX={d(m["BOX"])};')
    s.append(f'const VER_PH={d(m["VER_PH"])};')
    s.append(f'const REN={d(m["REN"])};')
    s.append(f'const PAIRS={d(m["PAIRS"])};')
    s.append(f'const TIME={d(m["TIME"])};')
    s.append(f'const MS={d(m["MS"])};')
    # Static site: no shared db. The Claude artifact build removes the next line (see docs/deployment.md).
    s.append('window.claude={use:async()=>null};')
    if instance:
        inst = {"name": instance["client"], "lanes": instance.get("lanes", {}), "variants": instance.get("variants", {}),
                "ren": instance.get("renewals", {}), "createdAt": "2026-01-01T00:00:00Z"}
        s.append(f'const PRESET_CLIENT={d(inst)};')
    else:
        s.append('const PRESET_CLIENT=null;')
    return "\n".join(s) + "\n"


def page(m, t, instance=None):
    head = fill((TEMPLATES / "page_head.html").read_text(encoding="utf-8"), t)
    logic = (TEMPLATES / "page_logic.js").read_text(encoding="utf-8")
    if instance:
        head = head.replace(f"<title>{t['title']}</title>",
                            f"<title>{t['title']}{html.escape(tf(t, 'title_client_suffix', client=instance['client']))}</title>")
    return head + js_data(m, t, instance) + logic + "\n</body>\n</html>\n"


# ---------- Static swimlane diagram (SVG) ----------
COLOR = {"L1": "#1F6FEB", "L2": "#0E9384", "L3": "#7A5AF8", "L4": "#D92D20", "L5": "#DC6803", "L6": "#A3820F", "L7": "#667085"}
TINT = {"L1": "#EAF2FE", "L2": "#E6F6F4", "L3": "#F1EEFE", "L4": "#FDECEA", "L5": "#FEF1E6", "L6": "#F8F3E0", "L7": "#F0F1F4"}


def svg_swimlanes(m, t, instance=None, title=None):
    esc = html.escape
    title = title or t["svg_title"]
    INK, MUTED, RULE, ARROW = "#1D2433", "#5B6475", "#E4E7EC", "#7D8596"
    FONT = "Calibri, Carlito, 'Segoe UI', Arial, sans-serif"
    X0, CW, BW, BH1, BH2, GAP, PADR, TOP = 132, 176, 158, 42, 56, 12, 16, 96
    HEAD = TOP + 92
    lanes = m["LANES"]; stages = m["STAGES"]; box = m["BOX"]
    col = {l[0]: i for i, l in enumerate(lanes)}
    bh = lambda b: BH2 if len(b[3]) > 1 else BH1
    rows = []
    for r in range(len(stages)):
        mx = BH2
        for l in lanes:
            cell = [b for b in box if b[2] == r and b[1] == l[0]]
            if cell: mx = max(mx, sum(bh(b) + GAP for b in cell) - GAP)
        rows.append(mx + 2 * PADR)
    rowY, y = [], HEAD
    for h in rows: rowY.append(y); y += h
    GB = y; W = X0 + len(lanes) * CW + 24; H = GB + 96
    pos = {}
    for r in range(len(stages)):
        for l in lanes:
            yy = rowY[r] + PADR
            for b in [b for b in box if b[2] == r and b[1] == l[0]]:
                pos[b[0]] = dict(x=X0 + col[l[0]] * CW + (CW - BW) / 2, y=yy, w=BW, h=bh(b)); yy += bh(b) + GAP
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="{FONT}">',
         f'<rect width="{W}" height="{H}" fill="#FFFFFF"/>',
         f'<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="{ARROW}"/></marker></defs>',
         f'<text x="24" y="40" font-size="24" font-weight="700" fill="{INK}">{esc(title)}</text>',
         f'<text x="24" y="66" font-size="14" fill="{MUTED}">{esc(t["svg_subtitle"])}</text>']
    lanenames = {l[0]: (instance or {}).get("lanes", {}).get(l[0], l[1]) for l in lanes}
    for i, l in enumerate(lanes):
        lid = l[0]; x = X0 + i * CW; cx = x + CW / 2; c = COLOR[lid]
        o.append(f'<rect x="{x+6}" y="{TOP}" width="{CW-12}" height="78" rx="8" fill="{TINT[lid]}"/><rect x="{x+6}" y="{TOP}" width="{CW-12}" height="5" rx="2" fill="{c}"/>')
        name = lanenames[lid]; words = name.split(" ")
        lines = [name] if len(name) <= 16 or len(words) == 1 else [" ".join(words[:len(words)//2 + len(words) % 2]), " ".join(words[len(words)//2 + len(words) % 2:])]
        for k, n in enumerate(lines):
            o.append(f'<text x="{cx}" y="{TOP+28+k*17}" text-anchor="middle" font-size="15" font-weight="700" fill="{c}">{esc(n)}</text>')
        sub = l[1] if instance and lanenames[lid] != l[1] else t["lane_sub_long"][lid]
        o.append(f'<text x="{cx}" y="{TOP+28+len(lines)*17+4}" text-anchor="middle" font-size="11.5" fill="{MUTED}">{esc(sub)}</text>')
    for i in range(len(lanes) + 1):
        x = X0 + i * CW; o.append(f'<line x1="{x}" x2="{x}" y1="{HEAD}" y2="{GB}" stroke="{RULE}"/>')
    for ry in rowY + [GB]:
        o.append(f'<line x1="16" x2="{W-16}" y1="{ry}" y2="{ry}" stroke="{RULE}"/>')
    for r, (n, phs) in enumerate(stages):
        w = n.split(" "); a = " ".join(w[:(len(w)+1)//2]); b = " ".join(w[(len(w)+1)//2:]); yb = rowY[r] + PADR
        o.append(f'<text x="24" y="{yb+14}" font-size="14" font-weight="700" fill="{INK}">{esc(a)}</text>')
        if b: o.append(f'<text x="24" y="{yb+31}" font-size="14" font-weight="700" fill="{INK}">{esc(b)}</text>')
        ph = f"{phs[0]}–{phs[-1]}" if len(phs) > 1 else phs[0]
        o.append(f'<text x="24" y="{yb+(49 if b else 32)}" font-size="12" fill="{MUTED}">{ph}</text>')
    for n in range(1, 22):
        a, b = pos.get(n), pos.get(n + 1)
        if not a or not b: continue
        ba, bb = box[n - 1], box[n]
        ac = (a["x"] + a["w"] / 2, a["y"] + a["h"] / 2); bc = (b["x"] + b["w"] / 2, b["y"] + b["h"] / 2)
        if ba[2] == bb[2] and a["x"] != b["x"]:
            lo, hi = min(a["x"], b["x"]), max(a["x"], b["x"]); y1, y2 = min(ac[1], bc[1]), max(ac[1], bc[1])
            if any(ob is not ba and ob is not bb and lo < pos[ob[0]]["x"] < hi and pos[ob[0]]["y"] <= y2 and pos[ob[0]]["y"] + pos[ob[0]]["h"] >= y1 for ob in box): continue
            sx = a["x"] + a["w"] if b["x"] > a["x"] else a["x"]; ex = b["x"] if b["x"] > a["x"] else b["x"] + b["w"]; dx = (ex - sx) / 2
            p = f'M{sx} {ac[1]}C{sx+dx} {ac[1]} {ex-dx} {bc[1]} {ex} {bc[1]}'
        else:
            sy, ey = a["y"] + a["h"], b["y"]; dy = max(18, (ey - sy) / 2)
            p = f'M{ac[0]} {sy}C{ac[0]} {sy+dy} {bc[0]} {ey-dy} {bc[0]} {ey}'
        o.append(f'<path d="{p}" fill="none" stroke="{ARROW}" stroke-width="1.4" marker-end="url(#ah)"/>')
    for n, lid, r, lines, _ in box:
        p = pos[n]; c = COLOR[lid]
        o.append(f'<rect x="{p["x"]}" y="{p["y"]}" width="{p["w"]}" height="{p["h"]}" rx="9" fill="{TINT[lid]}" stroke="{c}" stroke-width="1.4"/>')
        o.append(f'<circle cx="{p["x"]+15}" cy="{p["y"]+16}" r="10" fill="{c}"/><text x="{p["x"]+15}" y="{p["y"]+20}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#FFFFFF">{n}</text>')
        for k, tx in enumerate(lines):
            o.append(f'<text x="{p["x"]+32}" y="{p["y"]+21+k*16}" font-size="13" fill="{INK}">{esc(tx)}</text>')
    for k, tx in enumerate(t["svg_notes"]):
        o.append(f'<text x="24" y="{GB+30+k*20}" font-size="13" fill="{MUTED}">{esc(tx)}</text>')
    o.append("</svg>")
    return "\n".join(o)


def png(svg_path, png_path):
    if NO_PNG: return
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  notice: playwright not installed; PNG skipped"); return
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(device_scale_factor=2)
        pg.set_content('<html><body style="margin:0">' + svg_path.read_text(encoding="utf-8") + "</body></html>")
        pg.locator("svg").screenshot(path=str(png_path)); b.close()


def diff_md(m, t, inst):
    out = [f'# {tf(t, "diff_title", client=inst["client"])}', ""]
    out.append(f'{t["diff_profile"]}{inst.get("regulatory_profile", t["diff_undefined"])}'); out.append("")
    out.append(f'## {t["diff_lanes"]}'); out.append(f'| {t["diff_h_lane"]} | {t["diff_h_base"]} | {t["diff_h_client"]} |'); out.append("| --- | --- | --- |")
    for l in m["LANES"]:
        v = inst.get("lanes", {}).get(l[0])
        if v and v != l[1]: out.append(f"| {l[0]} | {l[1]} | {v} |")
    out.append(""); out.append(f'## {t["diff_variants"]}'); out.append(f'| {t["diff_h_variant"]} | {t["diff_h_option"]} |'); out.append("| --- | --- |")
    for k, key in inst.get("variants", {}).items():
        d = m["V"].get(k)
        if d:
            opt = next((o for o in d[1] if o.startswith(key + ")")), key)
            out.append(f"| {k} {d[0]} | {opt} |")
    unset = [k for k in m["V"] if k not in inst.get("variants", {})]
    if unset: out.append(""); out.append(t["diff_unset"] + ", ".join(unset))
    lanes = inst.get("lanes", {}); norm = lambda x: (x or "").strip().lower()
    hits = []
    for a, b, risk, sev in m["PAIRS"]:
        la = next(l[0] for l in m["LANES"] if a in l[3]); lb = next(l[0] for l in m["LANES"] if b in l[3])
        if la == lb or (norm(lanes.get(la)) and norm(lanes.get(la)) == norm(lanes.get(lb))):
            hits.append(tf(t, "diff_pair_line", a=m["A"][a], b=m["A"][b], lane=lanes.get(la), sev=t["severity"].get(sev, sev), risk=risk))
    out.append(""); out.append(f'## {t["diff_pairs"]}')
    out += hits or [t["diff_none"]]
    if inst.get("decisions"):
        out.append(""); out.append(f'## {t["diff_decisions"]}')
        out.append(f'| {t["diff_h_date"]} | {t["diff_h_decision"]} | {t["diff_h_owner"]} | {t["diff_h_rationale"]} |'); out.append("| --- | --- | --- | --- |")
        for d in inst["decisions"]: out.append(f'| {d["date"]} | {d["decision"]} | {d["owner"]} | {d["rationale"]} |')
    return "\n".join(out) + "\n"


def main():
    m = load_model(); t = load_strings(LANG)
    OUT.mkdir(exist_ok=True)
    (OUT / "index.html").write_text(page(m, t), encoding="utf-8")
    (OUT / "swimlanes.svg").write_text(svg_swimlanes(m, t), encoding="utf-8")
    png(OUT / "swimlanes.svg", OUT / "swimlanes.png")
    print("dist/index.html, swimlanes.svg" + ("" if NO_PNG else ", swimlanes.png"))
    clients = ROOT / "clients"
    for d in sorted(clients.iterdir()) if clients.exists() else []:
        f = d / "instance.json"
        if not f.exists(): continue
        inst = read_json(f); cd = OUT / "clients" / d.name; cd.mkdir(parents=True, exist_ok=True)
        (cd / "index.html").write_text(page(m, t, inst), encoding="utf-8")
        (cd / "swimlanes.svg").write_text(svg_swimlanes(m, t, inst, tf(t, "svg_client_title", client=inst["client"])), encoding="utf-8")
        png(cd / "swimlanes.svg", cd / "swimlanes.png")
        (OUT / f"diff-{d.name}.md").write_text(diff_md(m, t, inst), encoding="utf-8")
        print(f"dist/clients/{d.name}/ and dist/diff-{d.name}.md")


if __name__ == "__main__":
    main()
