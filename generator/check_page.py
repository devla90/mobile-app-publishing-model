#!/usr/bin/env python3
"""Check the generated pages and the plan they compute.

Usage:
  python3 generator/check_page.py                     # run after build.py
  python3 generator/check_page.py --require-browser   # fail if playwright is missing (CI)
  CHECK_PAGE_BROWSER=chrome python3 generator/check_page.py   # use the installed Chrome or Edge (msedge)

Static checks always run: every class written by page_logic.js has a rule in page_head.html, and every UI string
the page reads exists in the i18n file. With playwright it also opens dist/index.html and each
clients/<id>/dist/index.html and fails on any page error, and runs the plan tests on clients/example with a fixed
clock: forecast from today, platforms and joint activities, postponements, refused end dates, the CSV export and
the local date. On a machine where downloading Chromium is blocked, CHECK_PAGE_BROWSER uses the browser already
installed; without playwright the browser checks are skipped and only the static ones run.
Exit code 1 on any problem.
"""
import csv, datetime as dt, io, json, os, re, shutil, subprocess, sys
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

LIMA = dt.timezone(dt.timedelta(hours=-5))
EXAMPLE = ROOT / "clients" / "example" / "dist" / "index.html"


def plan_tests(browser):
    """Reference cases on the example instance (start 2026-11-02, iOS and Android). Returns a list of failures."""
    fail = []
    check = lambda ok, msg: ok or fail.append(msg)

    def page_at(when, tz="America/Lima"):
        ctx = browser.new_context(timezone_id=tz, accept_downloads=True); page = ctx.new_page(); errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.clock.set_fixed_time(when); page.goto(EXAMPLE.as_uri()); return ctx, page, errors

    def export(page, official):
        with page.expect_download() as dl: page.evaluate(f"()=>exportCsv({'true' if official else 'false'})")
        rows = list(csv.reader(io.StringIO(open(dl.value.path(), encoding="utf-8-sig").read()), delimiter=";"))
        head = rows.index(next(r for r in rows if r and r[0] == "N°"))
        return dict(r for r in rows[:head] if len(r) == 2), rows[head], rows[head + 1:]

    # On 20 Nov the first activity (2–8 Nov) is overdue: it ends today and what follows moves.
    ctx, page, errors = page_at(dt.datetime(2026, 11, 20, 10, 0, tzinfo=LIMA))
    v = page.evaluate("""()=>{const s=planSrc();const v=planView(s,s.start);const j=v.nodes.find(n=>n.id==="security-approval");
      return {today:dayOf(s.start,todayISO()),first:v.raw["decide-owner"],firstPlanned:v.before["decide-owner"],next:v.raw["approve-stores@ios"],
        iosOnly:[!!v.raw["register-app-ids@ios"],!!v.raw["register-app-ids@android"]],joint:[v.raw[j.id].s,Math.max(...j.after.map(x=>v.raw[x].e))],
        nodes:v.nodes.length,slack:v.nodes.filter(n=>!n.cont&&!n.done).map(n=>[v.raw[n.id].crit,v.raw[n.id].slack])}}""")
    check(v["first"]["late"] and v["first"]["e"] == v["today"], f"forecast: an overdue activity should end today ({v['first']})")
    check(v["firstPlanned"]["e"] == 7, f"forecast: the plan as written should keep the planned end ({v['firstPlanned']})")
    check(v["next"]["s"] >= v["today"], f"forecast: what follows an overdue activity should not start before today ({v['next']})")
    check(v["iosOnly"] == [True, False], f"platforms: an iOS-only activity should have no Android node ({v['iosOnly']})")
    check(v["joint"][0] == v["joint"][1], f"joint: a joint activity should start when the last platform is ready ({v['joint']})")
    # Working calendar: 5 working days from Monday 2 Nov end on Monday 9; a working day before a holiday and a weekend
    # hands over on the next working day; a store activity counts every day.
    cal = page.evaluate("""()=>{const s=planSrc();const W=workCal(s.start);const v=planView(s,s.start);const iso=n=>{const d=new Date(s.start+"T00:00:00");d.setDate(d.getDate()+n);return isoDate(d)};
      const q=v.raw["verify-entity@ios"];return{after:iso(W.add(dayOf(s.start,"2026-12-24"),1)),sat:W.isWork(dayOf(s.start,"2026-11-07")),store:q.e-q.s,
        weekend:v.nodes.filter(n=>!n.cont&&!n.done&&n.cal!=="calendar").some(n=>{const d=new Date(iso(v.raw[n.id].s)+"T00:00:00").getDay();return d===0||d===6})}}""")
    check(cal["after"] == "2026-12-28" and cal["sat"] is False, f"calendar: holidays and weekends should be skipped ({cal})")
    check(cal["store"] == 13 and cal["weekend"] is False, f"calendar: store activities count every day and working ones never start on a weekend ({cal})")
    page.evaluate("()=>{st.tlEdit='prepare-listing';renderTimeline()}")
    check("Días laborables" in (page.text_content("#timeline .pedit") or ""), "calendar: the edit row should say the days are working days")
    check(all(sl == 0 for c, sl in v["slack"] if c) and any(sl > 0 for c, sl in v["slack"] if not c), f"slack: critical activities should have 0 and some others more ({v['slack']})")
    page.click("#tabRm"); check("Atrasado" in page.inner_text(".rmsum"), "roadmap: an overdue plan should read as late")
    # An end date before the predecessors is refused; a later one is stored as a postponement.
    page.evaluate("""()=>onPlanChange({target:{dataset:{act:"define-identifiers",f:"endPlat",plat:"android"},value:"2026-11-03"}})""")
    check(page.evaluate("()=>!planSrc().plan['define-identifiers']"), "end date: a date before the predecessors should be refused")
    later = page.evaluate("""()=>{const s=planSrc();const v=planView(s,s.start);const e=v.raw["create-store-app@android"].e+10;
      const d=new Date(s.start+"T00:00:00");d.setDate(d.getDate()+e);const iso=isoDate(d);
      onPlanChange({target:{dataset:{act:"create-store-app",f:"endPlat",plat:"android"},value:iso}});return iso}""")
    p = page.evaluate("""()=>{const s=planSrc();const v=planView(s,s.start);const a=v.list.find(x=>x.id==="create-store-app");
      return {stored:(s.plan["create-store-app"]||{}).platforms,moved:a.moved,next:v.raw["issue-certificates@android"].s,end:v.raw["create-store-app@android"].e}}""")
    check(p["stored"] and p["stored"]["android"]["end"] == later, f"postponement: the new end should be stored ({p['stored']})")
    check(p["moved"] == 10 and p["next"] >= p["end"], f"postponement: it should count 10 days and move what follows ({p})")
    # The reason sits next to the end it explains; a note alone counts as "other" until a category is chosen.
    page.evaluate("""()=>{const t={dataset:{act:"create-store-app",plat:"android"}};onPlanChange({target:{...t,dataset:{...t.dataset,f:"reasonNotePlat"},value:"Tienda en revisión"}});
      onPlanChange({target:{...t,dataset:{...t.dataset,f:"reasonPlat"},value:"external"}})}""")
    why = page.evaluate("()=>planSrc().plan['create-store-app'].platforms.android.reason")
    check(why == {"type": "external", "note": "Tienda en revisión"}, f"reason: it should be stored with the end ({why})")
    page.click("#tabRm"); page.click(".rmdetail summary")
    check("Bloqueo externo" in page.inner_text(".rmdetail"), "reason: the roadmap should list the postponement with its reason")
    # Baseline bars are always drawn; the slack only while the toggle is on.
    check(page.locator(".rmdetail .gbl").count() > 0, "baseline: the gantt should draw the committed bars")
    check(page.locator(".gslack").count() == 0, "slack: it should be hidden by default")
    page.click("#rmSlack"); shown = page.locator(".gslack").count(); page.click("#rmSlack")
    check(shown > 0 and page.locator(".gslack").count() == 0, f"slack: the toggle should show and hide it ({shown})")
    # CSV: one row per activity and platform; the official export ignores the browser changes.
    meta, head, rows = export(page, official=False)
    check(len(head) == 22 and len(rows) == v["nodes"], f"csv: expected 22 columns and {v['nodes']} rows, got {len(head)} and {len(rows)}")
    row = next((r for r in rows if r[1].startswith("Crea la app") and r[4] == "Android"), None)
    # Postponed by hand 10 days, on top of what the overdue first activity already pushed: the deviation counts both.
    check(row and row[16] == "10" and int(row[11]) > 10, f"csv: the postponed row should show 10 days moved by hand and a larger deviation ({row})")
    check(row and row[17] == "Bloqueo externo" and row[18] == "Tienda en revisión", f"csv: the postponed row should carry its reason ({row})")
    check(all(r[20].isdigit() for r in rows if r[7] not in ("Hecha", "Continua")), "csv: every pending row should have its slack")
    check(meta.get("Origen", "").startswith("Con cambios"), f"csv: the source should say it has local changes ({meta})")
    meta, head, rows = export(page, official=True)
    row = next((r for r in rows if r[1].startswith("Crea la app") and r[4] == "Android"), None)
    check(meta.get("Origen", "").startswith("Plan oficial") and row and row[16] == "0", f"csv: the official export should ignore local changes ({meta}, {row})")
    check(any(r[15] == "D1" for r in rows if r[1].startswith("Custodia")), "csv: an open decision should appear on the activity it holds back")
    # The page hands back the whole instance.json with this browser's plan and a dated entry in plan_log.
    check("Plan actualizado el" in page.inner_text("#roadmap .rmhead"), "plan log: the roadmap should say when the plan was updated")
    # Open risks show in the committee view and on the sheet of the activity they affect.
    # The committee block names open decisions and high risks only; the full tables sit in the detail section.
    check("D1" in page.inner_text(".rmfocus") and "RG1" not in page.inner_text(".rmfocus"), "committee: open decisions and only high risks above the milestones")
    check(page.locator(".rmdetail #rmRisks").count() == 1 and page.locator(".rmdetail #rmDecs").count() == 1, "committee: the full tables should live in the detail section")
    # In the detail, the schedule comes first; decisions and risks are folded until opened, for instance from the committee block.
    check(page.evaluate("()=>!document.getElementById('rmDecs').open&&!document.getElementById('rmRisks').open"), "detail: decisions and risks should start folded")
    check(page.evaluate("()=>!!(document.querySelector('.rmdetail .gantt').compareDocumentPosition(document.getElementById('rmDecs'))&Node.DOCUMENT_POSITION_FOLLOWING)"), "detail: the schedule should come before the decisions")
    page.locator(".rmfocus [data-gofocus='rmDecs']").first.click()
    check(page.evaluate("()=>document.getElementById('rmDecs').open"), "detail: a decision in the committee block should open its table")
    # A step moved by the instance shows in its new activity, with a note, and leaves the old one.
    page.evaluate("()=>openAct('create-developer-accounts')")
    check("S1.5" in page.inner_text("#detail") and "movido desde la actividad 3" in page.inner_text("#detail"), "step moves: the step should show in its new activity with a note")
    check(page.locator("#detail .anotes b").count() == 1 and "exactamente como figura" in page.inner_text("#detail .anotes"), "notes: the sheet should show the client's notes with their bold text")
    # Lanes follow instance.json even when the browser kept an older copy of the client.
    page.evaluate("()=>{const c=JSON.parse(localStorage.getItem(pageKey('mapm-clients')));c.preset.lanes={...c.preset.lanes,L2:'old'};localStorage.setItem(pageKey('mapm-clients'),JSON.stringify(c))}")
    page.reload(); check(page.evaluate("()=>cur().lanes.L2")==page.evaluate("()=>PRESET_CLIENT.lanes.L2"), "lanes: a rebuilt page should take the lanes of instance.json")
    # A conditional step the instance skips leaves the steps and is named with its reason.
    page.evaluate("()=>openAct('assign-access')")
    check("S3.5" not in page.inner_text("#detail .asteps") and "No aplican en este cliente" in page.inner_text("#detail"), "step skips: a skipped step should leave the list and be named with its reason")
    # A step that exists only with another option of a chosen variant (applies_if) leaves the sheet too.
    page.evaluate("()=>openAct('create-store-app')")
    check("S5.5" not in page.inner_text("#detail .asteps") and "se eligió V11 a)" in page.inner_text("#detail"), "applies_if: a step of another option should leave the sheet with its reason")
    page.evaluate("()=>openAct('create-identities')")
    check("S1.5" not in page.inner_text("#detail .asteps"), "step moves: the step should leave the activity of the model")
    page.evaluate("()=>openAct('verify-entity')")
    check("RG1" in page.inner_text("#detail"), "risks: the activity sheet should list the risks that affect it")
    with page.expect_download() as dl: page.evaluate("()=>downloadInstance()")
    got = json.load(open(dl.value.path(), encoding="utf-8")); src = json.loads((ROOT / "clients" / "example" / "instance.json").read_text(encoding="utf-8"))
    plan = page.evaluate("()=>planSrc().plan"); last = got.get("plan_log", [{}])[-1]
    check(got.get("plan") == plan and all(got.get(k) == v for k, v in src.items() if k not in ("plan", "plan_log")), "download: only plan and plan_log should change")
    check(last.get("date") == "2026-11-20" and any("Bloqueo externo" in x for x in last.get("changes", [])) and len(got["plan_log"]) == len(src["plan_log"]) + 1,
          f"download: plan_log should get today's entry with the reason ({last})")
    tmp = ROOT / "clients" / "zz-check-download"; tmp.mkdir(exist_ok=True)
    try:
        (tmp / "instance.json").write_text(json.dumps(got, ensure_ascii=False, indent=2), encoding="utf-8")
        out = subprocess.run([sys.executable, str(ROOT / "generator" / "validate.py")], capture_output=True, text=True)
        check(out.returncode == 0, f"download: the instance should pass validate.py ({out.stdout.strip()[-300:]})")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    fail += [f"page error: {e}" for e in errors]; ctx.close()
    # Expected progress uses the committed start: changing the duration later must not move it (2–8 Nov, day 3 of 6).
    ctx, page, errors = page_at(dt.datetime(2026, 11, 5, 10, 0, tzinfo=LIMA))
    page.evaluate("""()=>onPlanChange({target:{dataset:{act:"decide-owner",f:"days"},value:"12"}})""")
    meta, head, rows = export(page, official=False); row = rows[0]
    check(row[9] == "43" and row[11] == "9", f"baseline: expected 43% and 9 days of deviation against the committed dates ({row})")
    # A pending activity of 0 days is a visible marker, not a bar with no width.
    page.evaluate("""()=>onPlanChange({target:{dataset:{act:"assign-access",f:"days"},value:"0"}})""")
    page.click("#tabRm"); page.click(".rmdetail summary")
    check(page.locator(".rmdetail .gbar.zero").count() > 0, "gantt: a pending activity of 0 days should be drawn as a marker")
    check("1 día," in page.evaluate("()=>tf('rm_slack_tip',{n:1,d:'x'})"), "strings: n=1 should use the singular variant")
    fail += [f"page error: {e}" for e in errors]; ctx.close()
    # At 21:30 in Lima it is already the next day in UTC: "today" must stay local.
    ctx, page, _ = page_at(dt.datetime(2026, 11, 4, 2, 30, tzinfo=dt.timezone.utc))
    today = page.evaluate("()=>todayISO()"); check(today == "2026-11-03", f"local date: expected 2026-11-03, got {today}"); ctx.close()
    return fail


try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sync_playwright = None
    if "--require-browser" in sys.argv: problems.append("playwright is required (--require-browser) but not installed")
    else: print("notice: playwright not installed; pages not opened and plan tests skipped")
if sync_playwright:
    pages = [ROOT / "dist" / "index.html"] + sorted((ROOT / "clients").glob("*/dist/index.html"))
    with sync_playwright() as p:
        # CHECK_PAGE_BROWSER=chrome or msedge uses the browser already installed instead of a downloaded Chromium.
        browser = p.chromium.launch(channel=os.environ.get("CHECK_PAGE_BROWSER") or None)
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
        if EXAMPLE.exists():
            failed = plan_tests(browser)
            problems += [f"plan tests: {f}" for f in failed]
            print(f"plan tests: {'ok' if not failed else str(len(failed)) + ' problem(s)'}")
        browser.close()

if problems:
    print("\n".join(problems)); print(f"\n{len(problems)} problem(s)."); sys.exit(1)
print("OK: styles and UI strings in place" + (", pages open and plan tests pass." if sync_playwright else "."))
