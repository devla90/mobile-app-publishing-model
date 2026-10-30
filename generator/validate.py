#!/usr/bin/env python3
"""Validate model/*.json and clients/*/instance.json: syntax, IDs and cross-references.

Usage: python3 generator/validate.py
Exit code 1 on any problem. Run it before every commit; the validate workflow runs it on every pull request.
"""
import json, re, subprocess, sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / "model"
problems = []
say = lambda msg: problems.append(msg)
PLATFORMS = ("ios", "android", "both")
TARGETS = {"b": ["ios"], "c": ["android"]}  # V15 options that narrow the project to one platform


def check_plan(where, acts):
    """acts: {id: (days, after, continuous)}. Durations are whole days >= 0, every `after` exists, no cycles."""
    for i, (days, after, cont) in acts.items():
        if not cont and not (isinstance(days, int) and days >= 0):
            say(f"{where}: activity {i} needs a whole number of days >= 0")
        for a in after:
            if a.isdigit(): say(f"{where}: activity {i} waits for the number {a}; use its key (docs/conventions.md#activity-keys-and-numbers)")
            elif a not in acts: say(f"{where}: activity {i} waits for unknown activity {a}")
    state = {}
    def visit(i, path):
        if state.get(i) == 1: say(f"{where}: dependency cycle {' -> '.join(path + [i])}"); return
        if state.get(i) == 2 or i not in acts: return
        state[i] = 1
        for a in acts[i][1]: visit(a, path + [i])
        state[i] = 2
    for i in acts: visit(i, [])


def check_dates(where, o):
    """Dates and durations of one plan entry, for an activity or one of its platforms."""
    d = o.get("done")
    if d is not None and d is not True:
        try: date.fromisoformat(str(d))
        except ValueError: say(f"{where} done must be true or a YYYY-MM-DD date")
    if "end" in o:
        try: date.fromisoformat(str(o["end"]))
        except ValueError: say(f"{where} end must be a YYYY-MM-DD date")
    if "days" in o and not (isinstance(o["days"], int) and o["days"] >= 0): say(f"{where} days must be a whole number >= 0")
    if "min" in o or "max" in o: say(f"{where} uses min and max; activities now have one duration, `days` (docs/conventions.md#durations-and-the-timeline)")


def load(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        say(f"{path.relative_to(ROOT)}: invalid JSON ({e})"); return None


files = {n: load(MODEL / f"{n}.json") for n in
         ["actors", "platforms", "credentials", "artifacts", "phases", "steps", "variants", "renewals", "milestones", "diagram"]}
if any(v is None for v in files.values()):
    print("\n".join(problems)); sys.exit(1)

actors, phases, steps = files["actors"], files["phases"], files["steps"]
roles = set(actors["roles"]); lanes = {l["id"] for l in actors["lanes"]}
phase_ids = {p["id"] for p in phases["phases"]}
step_ids = {s["id"] for s in steps["steps"]}
variant_ids = set(files["variants"]["items"]); cred_ids = set(files["credentials"]["items"]); art_ids = set(files["artifacts"]["items"])
renewal_ids = {r["id"] for r in files["renewals"]["items"]}

# Roles and lanes
for rid, r in actors["roles"].items():
    if r["lane"] not in lanes: say(f"actors: role {rid} points to unknown lane {r['lane']}")
lane_roles = [a for l in actors["lanes"] for a in l["roles"]]
for a in lane_roles:
    if a not in roles: say(f"actors: lane lists unknown role {a}")
for a in roles - set(lane_roles): say(f"actors: role {a} is in no lane")
for p in actors["incompatible_pairs"]:
    for a in p["roles"]:
        if a not in roles: say(f"actors: incompatible pair names unknown role {a}")
    if p["severity"] not in ("high", "medium", "low"): say(f"actors: bad severity '{p['severity']}'")

# Phases
freqs = set(phases["frequencies"])
for p in phases["phases"]:
    if p["frequency"] not in freqs: say(f"phases: {p['id']} has unknown frequency {p['frequency']}")
for st in phases["stages"]:
    for ph in st["phases"]:
        if ph not in phase_ids: say(f"phases: stage '{st['name']}' lists unknown phase {ph}")
for ph in phases["per_version_phases"]:
    if ph not in phase_ids: say(f"phases: per_version_phases has unknown phase {ph}")

# Steps
seen = set()
for s in steps["steps"]:
    sid = s["id"]
    if sid in seen: say(f"steps: duplicate id {sid}")
    seen.add(sid)
    if s["phase"] not in phase_ids or not sid.startswith(s["phase"] + "."): say(f"steps: {sid} phase mismatch ({s['phase']})")
    if s["platform"] not in PLATFORMS: say(f"steps: {sid} bad platform '{s['platform']}'")
    for a in re.findall(r"A\d\d", s["owner"]):
        if a not in roles: say(f"steps: {sid} owner names unknown role {a}")
    if not re.findall(r"A\d\d", s["owner"]): say(f"steps: {sid} owner has no role id")
    for d in s["depends_on"]:
        if d not in step_ids: say(f"steps: {sid} depends_on unknown step {d}")
    for v in s["variants"]:
        if v not in variant_ids: say(f"steps: {sid} names unknown variant {v}")
    for c in re.findall(r"\bC\d\d\b", s["inputs"] + " " + s["outputs"]):
        if c not in cred_ids: say(f"steps: {sid} names unknown credential {c}")
    for f in re.findall(r"\bF\d\d\b", s["inputs"] + " " + s["outputs"]):
        if f not in art_ids: say(f"steps: {sid} names unknown artifact {f}")

# Platforms
for pid, p in files["platforms"]["items"].items():
    if p["platform"] not in PLATFORMS: say(f"platforms: {pid} bad platform '{p['platform']}'")
for vid, v in files["variants"]["items"].items():
    if v.get("platform", "both") not in PLATFORMS: say(f"variants: {vid} bad platform '{v['platform']}'")

# Renewals, milestones, diagram
for r in files["renewals"]["items"]:
    if r["step"] and r["step"] not in step_ids: say(f"renewals: {r['id']} points to unknown step {r['step']}")
for m in files["milestones"]["milestones"]:
    for ph in m["phases"]:
        if ph not in phase_ids: say(f"milestones: {m['id']} lists unknown phase {ph}")
    for c in m["checks"]:
        if c["step"] not in step_ids: say(f"milestones: check {c['id']} points to unknown step {c['step']}")
n_stages = len(phases["stages"])
base_plan = {a["key"]: (a.get("duration", {}).get("days"), a.get("after", []), a.get("continuous", False))
             for a in files["diagram"]["activities"]}
keys = [a["key"] for a in files["diagram"]["activities"]]
for k in {x for x in keys if keys.count(x) > 1}: say(f"diagram: duplicate activity key {k}")
for k in keys:
    if not re.fullmatch(r"[a-z]+(-[a-z]+)*", k): say(f"diagram: activity key '{k}' must be lowercase words joined by hyphens")
check_plan("diagram", base_plan)
for a in files["diagram"]["activities"]:
    if a["lane"] not in lanes: say(f"diagram: activity {a['key']} unknown lane {a['lane']}")
    if not 0 <= a["stage"] < n_stages: say(f"diagram: activity {a['key']} stage index out of range")
    if a.get("platform") not in PLATFORMS: say(f"diagram: activity {a['key']} bad platform '{a.get('platform')}'")
    if not isinstance(a.get("joint"), bool): say(f"diagram: activity {a['key']} needs joint true or false")
    if a.get("joint") and a.get("platform") != "both": say(f"diagram: activity {a['key']} is joint, so its platform must be both")
    for ph in a["phases"]:
        if ph not in phase_ids: say(f"diagram: activity {a['key']} lists unknown phase {ph}")

for x in files["diagram"]["arrows"]:
    if x[0] not in base_plan or x[1] not in base_plan: say(f"diagram: arrow {x} names an unknown activity")
    if x[2] not in ("h", "v", "s", "r", "l", "g"): say(f"diagram: arrow {x} has an unknown route")

# Client instances
clients = ROOT / "clients"
for f in sorted(clients.glob("*/instance.json")) if clients.exists() else []:
    inst = load(f)
    if inst is None: continue
    rel = f.relative_to(ROOT)
    if "client" not in inst: say(f"{rel}: missing 'client'")
    for l in inst.get("lanes", {}):
        if l not in lanes: say(f"{rel}: unknown lane {l}")
    for v, key in inst.get("variants", {}).items():
        if v not in variant_ids: say(f"{rel}: unknown variant {v}")
        elif key not in {o["key"] for o in files["variants"]["items"][v]["options"]}: say(f"{rel}: variant {v} has no option '{key}'")
    targets = TARGETS.get(inst.get("variants", {}).get("V15"), ["ios", "android"])
    for v in inst.get("variants", {}):
        if files["variants"]["items"].get(v, {}).get("platform", "both") not in targets + ["both"]:
            say(f"{rel}: variant {v} does not apply to the platforms chosen in V15")
    for r, d in inst.get("renewals", {}).items():
        if r not in renewal_ids: say(f"{rel}: unknown renewal {r}")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(d)): say(f"{rel}: renewal {r} date must be YYYY-MM-DD")
    if "start_date" in inst:
        try: date.fromisoformat(str(inst["start_date"]))
        except ValueError: say(f"{rel}: start_date must be a valid YYYY-MM-DD date")
    # Plan: overrides of base activities and the client's own activities (docs/conventions.md#durations-and-the-timeline)
    acts = dict(base_plan)
    for x in inst.get("extra_activities", []):
        xid = str(x.get("id", ""))
        if not xid or xid in base_plan: say(f"{rel}: extra activity needs an id not used by the model ('{xid}')"); continue
        if x.get("lane") not in lanes: say(f"{rel}: extra activity {xid} has unknown lane {x.get('lane')}")
        if not x.get("name"): say(f"{rel}: extra activity {xid} has no name")
        check_dates(f"{rel}: extra activity {xid}", x)
        acts[xid] = (x.get("days"), [str(a) for a in x.get("after", [])], False)
        if x.get("platform", "both") not in PLATFORMS: say(f"{rel}: extra activity {xid} bad platform '{x['platform']}'")
        if not isinstance(x.get("joint", True), bool): say(f"{rel}: extra activity {xid} needs joint true or false")
    for k, o in inst.get("plan", {}).items():
        if k.isdigit(): say(f"{rel}: plan uses the activity number {k}; instances now use keys (docs/conventions.md#activity-keys-and-numbers)"); continue
        if k not in acts: say(f"{rel}: plan names unknown activity {k}"); continue
        days, after, cont = acts[k]
        acts[k] = (o.get("days", days), [str(a) for a in o.get("after", after)], cont)
        check_dates(f"{rel}: plan {k}", o)
        for pl, q in o.get("platforms", {}).items():
            if pl not in targets: say(f"{rel}: plan {k} names platform '{pl}', which is not a target")
            check_dates(f"{rel}: plan {k} {pl}", q)
            if "blocked" in q and not (isinstance(q["blocked"], str) and q["blocked"]): say(f"{rel}: plan {k} {pl} blocked must be a text")
    check_plan(str(rel), acts)

# Real client instances and their output (clients/<id>/dist/) must never be versioned (docs/deployment.md#private-client-instances).
# Client output used to live in dist/clients/ and dist/diff-*.md; nothing may remain tracked there.
# Checks the git index, so a forced `git add -f` is caught before the commit. Skipped outside a git checkout.
try:
    tracked = subprocess.run(["git", "ls-files", "--", "clients", "dist/clients", "dist/diff-*.md"], cwd=ROOT,
                             capture_output=True, text=True, check=True).stdout.split()
except (OSError, subprocess.CalledProcessError):
    tracked = []
for p in tracked:
    if p.startswith("dist/"):
        say(f"{p}: client output now lives in clients/<id>/dist/; remove the old copy with `git rm --cached`")
    elif not p.startswith("clients/example/"):
        say(f"{p}: real client instance is versioned; remove it with `git rm --cached` (only example/ may be committed)")

if problems:
    print("\n".join(problems)); print(f"\n{len(problems)} problem(s)."); sys.exit(1)
print(f"OK: {len(roles)} roles, {len(phase_ids)} phases, {len(step_ids)} steps, {len(variant_ids)} variants, {len(renewal_ids)} renewals.")
