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


REASONS = ("external", "dependency", "decision", "team", "scope", "other")


def check_dates(where, o):
    """Dates and durations of one plan entry, for an activity or one of its platforms."""
    d = o.get("done")
    if d is not None and d is not True:
        try: date.fromisoformat(str(d))
        except ValueError: say(f"{where} done must be true or a YYYY-MM-DD date")
    for k in ("end", "start"):
        if k in o:
            try: date.fromisoformat(str(o[k]))
            except ValueError: say(f"{where} {k} must be a YYYY-MM-DD date")
    if "days" in o and not (isinstance(o["days"], int) and o["days"] >= 0): say(f"{where} days must be a whole number >= 0")
    if "min" in o or "max" in o: say(f"{where} uses min and max; activities now have one duration, `days` (docs/conventions.md#durations-and-the-timeline)")
    # The reason explains a postponement, so it lives next to the end it explains (docs/conventions.md#postponements).
    if "reason" in o:
        r = o["reason"]
        if "end" not in o and "start" not in o: say(f"{where} reason needs a start or an end date in the same entry")
        if not isinstance(r, dict) or r.get("type") not in REASONS:
            say(f"{where} reason must be {{\"type\": one of {', '.join(REASONS)}, \"note\": text}}")
        elif "note" in r and not (isinstance(r["note"], str) and r["note"]): say(f"{where} reason note must be a text")


def check_milestone(where, a):
    m = a.get("milestone")
    if m is None: return
    if not (isinstance(m, dict) and isinstance(m.get("name"), str) and m["name"]): say(f"{where} milestone needs a name")
    elif m.get("type") not in ("achievement", "decision"): say(f"{where} milestone type must be achievement or decision")


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
    check_milestone(f"diagram: activity {a['key']}", a)
    if a.get("calendar", "work") not in ("work", "calendar"): say(f"diagram: activity {a['key']} calendar must be work or calendar")
    for ph in a["phases"]:
        if ph not in phase_ids: say(f"diagram: activity {a['key']} lists unknown phase {ph}")

# A step that exists only with one option of a variant names it in applies_if (docs/conventions.md#stepsjson).
for s in steps["steps"]:
    for vid, key in s.get("applies_if", {}).items():
        v = files["variants"]["items"].get(vid)
        if v is None: say(f"steps: {s['id']} applies_if names unknown variant {vid}"); continue
        if key not in [o["key"] for o in v["options"]]: say(f"steps: {s['id']} applies_if names unknown option {vid} {key}")
        if vid not in s.get("variants", []): say(f"steps: {s['id']} applies_if names {vid}, which is not in its variants")

# Every step belongs to exactly one activity, of a phase and platform that fit it.
step_by_id = {s["id"]: s for s in steps["steps"]}
owner_of = {}
for a in files["diagram"]["activities"]:
    for sid in a.get("steps", []):
        s = step_by_id.get(sid)
        if not s: say(f"diagram: activity {a['key']} lists unknown step {sid}"); continue
        if sid in owner_of: say(f"diagram: step {sid} is in {owner_of[sid]} and {a['key']}")
        owner_of[sid] = a["key"]
        if s["phase"] not in a["phases"]: say(f"diagram: step {sid} is in phase {s['phase']}, which activity {a['key']} does not list")
        if a.get("platform") != "both" and s["platform"] not in (a.get("platform"), "both"): say(f"diagram: step {sid} is {s['platform']}, but activity {a['key']} is {a.get('platform')}")
for sid in step_ids - set(owner_of): say(f"diagram: step {sid} belongs to no activity")

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
        check_milestone(f"{rel}: extra activity {xid}", x)
        if xid in {str(d.get("id")) for d in inst.get("open_decisions", [])}: say(f"{rel}: extra activity {xid} has the id of an open decision; give activities their own prefix (docs/conventions.md#client-activities)")
        if not all(isinstance(k, str) and k for k in x.get("tasks", [])): say(f"{rel}: extra activity {xid} tasks must be texts")
        for sid in x.get("refs", []):
            if sid not in step_ids: say(f"{rel}: extra activity {xid} refs unknown step {sid}")
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
    # Open decisions and the baseline (docs/conventions.md#decisions-areas-and-baseline)
    for x in inst.get("open_decisions", []):
        xid = x.get("id", "?")
        for f in ("id", "name", "owner"):
            if not (isinstance(x.get(f), str) and x[f]): say(f"{rel}: open decision {xid} needs {f}")
        for f in ("due", "opened"):
            try: date.fromisoformat(str(x.get(f)))
            except ValueError: say(f"{rel}: open decision {xid} {f} must be a YYYY-MM-DD date")
        for k in x.get("blocks", []):
            if k not in acts: say(f"{rel}: open decision {xid} blocks unknown activity {k}")
        if x.get("platform") and x["platform"] not in targets: say(f"{rel}: open decision {xid} names platform '{x['platform']}', which is not a target")
    # Steps a client does in another activity of the model (docs/conventions.md#client-activities).
    plat_of = {a["key"]: a["platform"] for a in files["diagram"]["activities"]}
    for sid, to in inst.get("step_moves", {}).items():
        s = step_by_id.get(sid)
        if not s: say(f"{rel}: step_moves names unknown step {sid}"); continue
        if to not in plat_of: say(f"{rel}: step_moves sends {sid} to {to}, which is not an activity of the model"); continue
        if owner_of.get(sid) == to: say(f"{rel}: step_moves sends {sid} to {to}, where it already is")
        if plat_of[to] != "both" and s["platform"] not in (plat_of[to], "both"): say(f"{rel}: step {sid} is {s['platform']}, but activity {to} is {plat_of[to]}")
    # Working calendar: which weekdays count and which dates are holidays (docs/conventions.md#working-calendar).
    cal = inst.get("calendar", {})
    if cal:
        wd = cal.get("workdays", [1, 2, 3, 4, 5])
        if not (isinstance(wd, list) and wd and all(d in range(1, 8) for d in wd) and len(set(wd)) == len(wd)): say(f"{rel}: calendar workdays must be distinct numbers from 1 (Monday) to 7 (Sunday)")
        seen_h = set()
        for h in cal.get("holidays", []):
            try: day = date.fromisoformat(str(h.get("date")))
            except (ValueError, AttributeError): say(f"{rel}: calendar holiday {h} needs a YYYY-MM-DD date"); continue
            if not (isinstance(h.get("name"), str) and h["name"]): say(f"{rel}: calendar holiday {day} needs a name")
            if day in seen_h: say(f"{rel}: calendar holiday {day} is repeated")
            seen_h.add(day)
    for x in inst.get("extra_activities", []):
        if x.get("calendar", "work") not in ("work", "calendar"): say(f"{rel}: activity {x.get('id')} calendar must be work or calendar")
    # Notes the client keeps on an activity, shown on its sheet.
    for k, ns in inst.get("notes", {}).items():
        if k not in acts: say(f"{rel}: notes name unknown activity {k}")
        if not (isinstance(ns, list) and ns and all(isinstance(x, str) and x for x in ns)): say(f"{rel}: notes of {k} must be a list of texts")
    # Conditional steps that do not apply to this client, each with its reason.
    for sid, why in inst.get("step_skips", {}).items():
        s = step_by_id.get(sid)
        if not s: say(f"{rel}: step_skips names unknown step {sid}"); continue
        if not (isinstance(why, str) and why): say(f"{rel}: step_skips {sid} needs a reason")
        if not s.get("note", "").startswith("Condicional"): say(f"{rel}: step {sid} is not conditional in the model, so it cannot be skipped")
        if sid in inst.get("step_moves", {}): say(f"{rel}: step {sid} is both moved and skipped")
    # Risks: what may still happen, with its severity, owner and mitigation (docs/conventions.md#decisions-areas-and-baseline).
    taken = {x.get("id") for x in inst.get("open_decisions", [])} | {str(x.get("id")) for x in inst.get("extra_activities", [])}
    seen = set()
    for x in inst.get("risks", []):
        xid = x.get("id", "?")
        for f in ("id", "name", "owner", "mitigation"):
            if not (isinstance(x.get(f), str) and x[f]): say(f"{rel}: risk {xid} needs {f}")
        if x.get("severity") not in ("high", "medium"): say(f"{rel}: risk {xid} severity must be high or medium")
        if x.get("status", "open") not in ("open", "closed"): say(f"{rel}: risk {xid} status must be open or closed")
        for k in x.get("affects", []):
            if k not in acts: say(f"{rel}: risk {xid} affects unknown activity {k}")
        if x.get("platform") and x["platform"] not in targets: say(f"{rel}: risk {xid} names platform '{x['platform']}', which is not a target")
        if xid in taken or xid in seen: say(f"{rel}: risk id {xid} is already used by a decision, an activity or another risk")
        seen.add(xid)
    # The plan log: one entry per update of the plan, oldest first (docs/conventions.md#plan-updates).
    last = ""
    for i, e in enumerate(inst.get("plan_log", [])):
        try:
            day = date.fromisoformat(str(e["date"])).isoformat()
            if day < last: say(f"{rel}: plan_log entry {i + 1} is older than the one before it")
            last = day
        except (TypeError, KeyError, ValueError):
            say(f"{rel}: plan_log entry {i + 1} needs a YYYY-MM-DD date")
        ch = e.get("changes") if isinstance(e, dict) else None
        if not (isinstance(ch, list) and ch and all(isinstance(x, str) and x for x in ch)):
            say(f"{rel}: plan_log entry {i + 1} needs changes, a list of texts")
    for k, d in inst.get("baseline", {}).items():
        key, _, plat = k.partition("@")
        if key not in acts: say(f"{rel}: baseline names unknown activity {key}")
        if plat and plat not in targets: say(f"{rel}: baseline names platform '{plat}', which is not a target")
        # Committed start and end, both written: a start deduced from the current duration would move with it.
        try:
            b0, b1 = date.fromisoformat(str(d["start"])), date.fromisoformat(str(d["end"]))
            if b0 > b1: say(f"{rel}: baseline {k} starts after it ends")
        except (TypeError, KeyError, ValueError):
            say(f"{rel}: baseline {k} must be {{\"start\": \"YYYY-MM-DD\", \"end\": \"YYYY-MM-DD\"}} (docs/conventions.md#decisions-areas-and-baseline)")

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
