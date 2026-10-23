#!/usr/bin/env python3
"""Validate model/*.json and clients/*/instance.json: syntax, IDs and cross-references.

Usage: python3 generator/validate.py
Exit code 1 on any problem. Run it before every commit; the validate workflow runs it on every pull request.
"""
import json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / "model"
problems = []
say = lambda msg: problems.append(msg)


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
    if s["platform"] not in ("ios", "android", "both"): say(f"steps: {sid} bad platform '{s['platform']}'")
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
    if p["platform"] not in ("ios", "android", "both"): say(f"platforms: {pid} bad platform '{p['platform']}'")

# Renewals, milestones, diagram
for r in files["renewals"]["items"]:
    if r["step"] and r["step"] not in step_ids: say(f"renewals: {r['id']} points to unknown step {r['step']}")
for m in files["milestones"]["milestones"]:
    for ph in m["phases"]:
        if ph not in phase_ids: say(f"milestones: {m['id']} lists unknown phase {ph}")
    for c in m["checks"]:
        if c["step"] not in step_ids: say(f"milestones: check {c['id']} points to unknown step {c['step']}")
n_stages = len(phases["stages"])
for a in files["diagram"]["activities"]:
    if a["lane"] not in lanes: say(f"diagram: activity {a['n']} unknown lane {a['lane']}")
    if not 0 <= a["stage"] < n_stages: say(f"diagram: activity {a['n']} stage index out of range")
    for ph in a["phases"]:
        if ph not in phase_ids: say(f"diagram: activity {a['n']} lists unknown phase {ph}")

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
    for r, d in inst.get("renewals", {}).items():
        if r not in renewal_ids: say(f"{rel}: unknown renewal {r}")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(d)): say(f"{rel}: renewal {r} date must be YYYY-MM-DD")

# Real client instances must never be versioned (docs/deployment.md#private-client-instances).
# Checks the git index, so a forced `git add -f` is caught before the commit. Skipped outside a git checkout.
try:
    tracked = subprocess.run(["git", "ls-files", "--", "clients", "dist/clients", "dist/diff-*.md"], cwd=ROOT,
                             capture_output=True, text=True, check=True).stdout.split()
except (OSError, subprocess.CalledProcessError):
    tracked = []
for p in tracked:
    if not re.match(r"(clients|dist/clients)/example/|dist/diff-example\.md$", p):
        say(f"{p}: real client instance is versioned; remove it with `git rm --cached` (only example/ may be committed)")

if problems:
    print("\n".join(problems)); print(f"\n{len(problems)} problem(s)."); sys.exit(1)
print(f"OK: {len(roles)} roles, {len(phase_ids)} phases, {len(step_ids)} steps, {len(variant_ids)} variants, {len(renewal_ids)} renewals.")
