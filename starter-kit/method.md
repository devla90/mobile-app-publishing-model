# The method in full

Reference for the assistant after `prompt.md`. It describes how the original repository is built and how a client engagement is run, without any domain or client content. Paste it as a second message or attach it.

## 1. Layers

| Layer | Where | Contains | Who sees it |
| --- | --- | --- | --- |
| Base | `model/*.json` | The neutral process: roles, lanes, phases, steps, variants, credentials, artifacts, platforms, renewals, milestones, diagram | Public or shareable |
| Regulatory profile | `profiles/PR-<SECTOR>-<COUNTRY>` | Controls and approvers that a sector in a country adds to the approvals phase | Shareable within the sector |
| Instance | `clients/<id>/instance.json` in a private repository | Real team per lane, chosen option per variant, open variants, renewal dates, decisions | Client team only |

An instance never copies the base. It writes only the difference; everything else is inherited.

## 2. File formats

Every file in `model/` starts with `description` (for maintainers, in the repository language) and `lang` (content language), then the data. Every element has a stable ID.

### `actors.json`

```json
{
  "description": "Generic roles, lanes and incompatible role pairs.",
  "lang": "<content-lang>",
  "roles": {
    "A01": { "name": "<role name>", "lane": "L6" }
  },
  "lanes": [
    { "id": "L1", "name": "<area>", "description": "<what this area does in the process>", "roles": ["A03", "A04"] }
  ],
  "incompatible_pairs": [
    { "roles": ["A12", "A13"], "risk": "<what can go wrong if one team holds both>", "severity": "high" }
  ]
}
```

A role belongs to exactly one lane, listed both in `roles.<id>.lane` and in the lane's `roles`.

A lane layout that has worked: business owner (decides, funds, owns accounts), IT (administers systems and identities), technical executor (in-house or vendor), security, legal/compliance/risk, legal representation and finance, external parties. One variant says who runs the technology (in-house vs third party).

### `phases.json`

```json
{
  "frequencies": { "owner": "<label>", "app": "<label>", "version": "<label>", "cycle": "<label>" },
  "phases": [
    { "id": "S0", "name": "<name>", "frequency": "owner",
      "duration": { "min": 3, "max": 15, "depends_on": "<what drives the duration>" } }
  ],
  "stages": [ { "name": "<stage>", "phases": ["S0", "S1"] } ],
  "per_version_phases": ["S8", "S9"]
}
```

The keys `owner` / `app` / `version` / `cycle` come from the original domain. Define one key per unit a phase repeats over (for example `organisation` / `item` / `cycle` / `recurring`) and keep them as enums with labels. `per_version_phases` lists the phases that repeat every cycle and drive the per-cycle checklist; rename it with the enum (`per_cycle_phases`) or drop it if nothing repeats. The validator and the page read these names, so change them there too.

### `steps.json`

```json
{
  "id": "S6.2",
  "phase": "S6",
  "name": "<short, infinitive or third person>",
  "platform": "both",
  "owner": "A03 o A05",
  "inputs": "F01",
  "outputs": "F02, C06",
  "depends_on": ["S6.1", "S4.2"],
  "variants": ["V4"],
  "note": "<what an operator must know that does not fit in the name>"
}
```

- `owner`, `inputs`, `outputs` are free text with IDs inside; the generator extracts the IDs to link them.
- `depends_on` means "cannot start without the output of". Empty if it can start whenever decided.
- `platform` (`ios` / `android` / `both` in the original) is only needed if the process forks by platform or channel. Rename the values for the domain or drop the field, and the matching filter in the page.

### `variants.json`

```json
{ "items": { "V1": { "name": "<phrased as a decision: 'Who signs'>",
                     "options": [ { "key": "a", "text": "<option>" }, { "key": "b", "text": "<option>" } ] } } }
```

No option text says "default" or "recommended". Every step that changes with the option lists the variant.

### Other files

- `platforms.json`: `{ "P01": { "name", "url", "purpose" } }`.
- `credentials.json`: `{ "C01": { "name", "validity" } }`, plus where it lives and who creates it if useful.
- `artifacts.json`: `{ "F01": { "name", "format" } }`.
- `renewals.json`: `[ { "id": "R01", "name", "group", "cycle_months", "lead_days", "if_expired", "renewed_by", "step" } ]`. `cycle_months: 0` means event- or policy-driven.
- `milestones.json`: `[ { "id": "m1", "name", "description", "phases": [...], "checks": [ { "id": "c1", "text", "step" } ] } ]`. About 10 milestones for business; checks link to steps so details stay reachable. A tracking record is opened per cycle (a version, a period) or, if the process runs once per item, per item.
- `diagram.json`: `[ { "n": 1, "lane": "L1", "stage": 0, "lines": ["<line 1>", "<line 2>"], "phases": ["S0"] } ]`. Around 25 boxes. A new step does not automatically get a box.

### `profiles/PR-<AXES>.json`

Same shape as a partial instance plus a list of controls. Name it by the axes the rules vary on (sector and country by default; also size, category or other if the domain needs it).

```json
{
  "profile": "PR-<SECTOR>-<COUNTRY>",
  "lang": "<content-lang>",
  "framework": [ { "norm": "<norm, number, year>", "requires": "<what>", "impacts": ["S13"] } ],
  "controls": [ { "id": "K1", "control": "<what is checked>", "approver": "A22", "evidence": "<record>", "before": "S14.1" } ]
}
```

`before` is the base step that cannot start until the control is passed, which is how a profile attaches to the model without an approvals phase of its own. If the base has an approvals phase, controls usually point to the step after it.

### `clients/<id>/instance.json`

```json
{
  "client": "<display name>",
  "lang": "<content-lang>",
  "description": "<what this instance is, reference date>",
  "regulatory_profile": "PR-<SECTOR>-<COUNTRY>",
  "lanes": { "L1": "<real team>", "L3": "<vendor>" },
  "variants": { "V1": "a", "V14": "b" },
  "open_variants": { "V4": "<assumed option and why; where it will be closed (session, question)>" },
  "renewals": { "R01": "2026-11-01" },
  "decisions": [ { "date": "2026-10-14", "decision": "<what>", "owner": "<team>", "rationale": "<why>" } ]
}
```

Lanes with no real owner keep the base's generic name. No personal names: areas or companies only.

## 3. Rules and why

| Rule | Why |
| --- | --- |
| Stable IDs, never renumbered; retired IDs stay unused | External documents, tickets and minutes cite them |
| Neutral base | One base serves every client; client facts would leak and go stale |
| Variants, not defaults | Each client picks; nothing is "normal" |
| Dated external data with source | External rules change; a monthly job re-checks the cited pages. Statuses: `OK`, `CORRECTED`, `INTERNAL` (company policy, cite document and version; not watched by the job), `NO SOURCE` |
| Repository language vs content language | Contributors work in the repository language; reviewers read content in theirs. Translating content without a domain reviewer introduces errors |
| Enums in the repository language, labels in data or i18n | Code compares enums; labels are content |
| Decisions recorded with date and rationale (`docs/decisions.md`) | "Why is it like this?" is the most frequent question months later |
| Incompatible pairs raise an alert instead of being forbidden | Small clients cannot always segregate, but the model must be able to say so |
| Tracking by milestones, not by steps | Ticking every step per cycle is tedious; milestones are what business follows |

## 4. Repository layout

```
model/             source of truth (JSON, keys in repository language, values in content language)
profiles/          regulatory profiles (optional)
clients/example/   instance template; every other clients/<id>/ is ignored by git. clients/<id>/dist/ holds each client's output
generator/         validate.py, build.py, check_sources.py, templates/, i18n/<lang>.json
dist/              generated for the base model: index.html, swimlanes.svg/.drawio/.png
docs/              model.md, conventions.md, decisions.md, validation.md, deployment.md
CLAUDE.md          guide for AI assistants (also works as AGENTS.md)
CHANGELOG.md       Keep a Changelog, [Unreleased] on top
.github/workflows/ validate.yml (PR check), check-sources.yml (monthly source watch)
```

`templates/CLAUDE.md` is the skeleton of the AI guide. Its key part is the table "task → read / do not read", which keeps the assistant from loading the whole repository (for example: to instantiate a client, read the instance template, the variants and only the lanes; never the full steps file).

Repeatable procedures (instantiate a client, edit the model, validate external requirements) are written as short step-by-step documents. In Claude Code they are skills under `.claude/skills/<name>/SKILL.md`; with other assistants keep them under `docs/procedures/` and paste the one you need.

## 5. Generator

All Python 3 with the standard library (Playwright only for the optional PNG).

- **`validate.py`**: loads every model file; checks JSON syntax, duplicate IDs, that a step's ID starts with its phase, that every role, lane, step, variant, credential and artifact referenced exists, that enums are valid, that each role is in exactly one lane, that instances use only known lanes, variants, options and renewals and that dates are `YYYY-MM-DD`. Finally it runs `git ls-files clients` and fails if anything other than `clients/example/` is tracked, so a forced `git add -f` of a real client is caught. Exit code 1 on any problem.
- **`build.py`**: reads the model and the UI strings (`i18n/<lang>.json`), and writes:
  - `dist/index.html`: a single page with the model embedded as JSON and tabs to explore entities, see the flow by phase, renewals and per-version tracking (stored in `localStorage`).
  - `dist/swimlanes.svg` and `.drawio`: lanes as rows, stages as columns, the diagram activities as numbered boxes with arrows.
  - For each instance: the same under `clients/<id>/dist/` (inside the client folder, so a private overlay holds everything) with real lane names, and `diff.md` listing lanes assigned, variants chosen and alerts (incompatible pairs that fall in the same team).
  - Flags: `--no-png`, `--lang <code>`.
- **`check_sources.py`**: extracts every URL from `docs/validation.md`, hashes the visible text of each page and compares with `generator/sources_hash.json`. `--update` stores the new reference after a human has reviewed the rows. Strip per-request noise before hashing (hidden IDs, timestamps), or every run reports changes.

`check_sources.py` and its workflow are only worth having if `docs/validation.md` cites public URLs.

Size of the original: `validate.py` ~125 lines, `build.py` ~370, page template ~320 lines of HTML/CSS and ~250 of JS. An assistant can write a new `validate.py` in one go; the page is better done in steps (data tab first, then flow, then diagram, then tracking).

To reuse the original code instead (only possible if you can copy files from the public repository `mobile-app-publishing-model`), these are the domain-bound parts to change:

- the list of model files loaded in `validate.py` and `build.py`;
- the `platform` enum and filter (`ios` / `android` / `both`);
- the frequency enum and `per_version_phases`;
- the tracking tab, which talks about "versions" (`page_logic.js`, labels in `i18n/<lang>.json`);
- `localStorage` key prefix (`mapm-`);
- all UI strings in `i18n/<lang>.json`.

## 6. CI and protection

- `validate.yml`: on every pull request to `main`, run `validate.py` and `build.py --no-png`. The job name (`validate`) is the required status check.
- `check-sources.yml`: monthly cron; if `check_sources.py` reports changes, open an issue listing them.
- Ruleset `main`: block deletion and force push, require pull request with 1 approval and the `validate` check; if working alone, add the admin role as bypass "for pull requests only".
- Ruleset `releases` on tags `v*`: block update, deletion and force push. Tag versions on `main` and describe them in `CHANGELOG.md`.

## 7. Private overlay per client

```
<workspace>/
  <base-repo>/                 public or shareable
  <client>-private/            private repository
    clients/<id>/              instance.json + working documents
    clients/<id>/dist/         generated output (written there by the build through the link)
```

```bash
cd <base-repo>
ln -s ../../<client>-private/clients/<id> clients/<id>
python3 generator/validate.py && python3 generator/build.py --no-png
```

`.gitignore` in the base:

```
clients/*
!clients/example/
```

Before pushing the base: `git check-ignore -v clients/<id>` must match a rule, and `git status --short` must show nothing with `<id>`. Commit client edits in the private repository.

## 8. Working with a client

The instance file is not enough on its own; the engagement produces a small set of working documents in the client's private folder. Templates are in `templates/`.

| Document | Purpose | Updated |
| --- | --- | --- |
| `README.md` | Index of the folder; operating model in one paragraph; table lane → real team → roles → what they do; incompatible pairs and how they are handled; table "what changes from the base" (base step → for this client → effect) | When a variant closes or a decision is taken |
| `instance.json` | Machine-readable difference from the base | Same |
| `open-points.md` | Assumptions about other parties' work, numbered O1…On, grouped by topic. Columns: topic, what we assume, what they must confirm, session/question, status (`Open` / `Confirmed` / `Corrected`), answer | After each session |
| `session-<n>.md` | One per meeting: objective, opening script (2 minutes: goal, what is already agreed, blocks, expected outcome), timed agenda by block with the profiles needed, numbered questions each linked to the open points it closes, expected-outcome checklist, agreements and pending items table (item, owner, date) | Before and after the session |
| `internal-decisions.md` | Decisions that depend only on the client, numbered D1…Dn. Columns: decision, owner, deadline, status, effect on the model. Take them resolved or owned to the first session, because they condition the answers | When resolved |
| `regulatory-profile.md` | Until a shared profile exists: legal framework table (norm, what it requires, where it impacts) and controls on the approvals phase (control, approver role, evidence, before which step) | When the profile layer is defined |
| Domain-specific annexes | For example an access matrix of portals to enable, or a summary of external rules the client must prepare for | As needed |

Closing loop after each session:

1. A confirmed assumption → status `Confirmed`. If it closes a variant, move it from `open_variants` to `variants`.
2. A corrected assumption → status `Corrected`, write the answer, add a decision to `instance.json` with date and owner.
3. Rebuild and update the client README's tables.
4. If the client needs a step the base does not have, that is a change to the base, modelled generically — never a client-specific step.

## 9. Order of work that worked

1. Interview, then agree phases, lanes, variants and incompatible pairs before writing JSON.
2. Write the base with few steps per phase, the validator and the example instance. Validate.
3. Fill steps phase by phase; add renewals, milestones and the diagram.
4. Write `docs/validation.md` with official sources for every external figure.
5. Generator and CI.
6. First client in a private overlay: internal decisions, open points, first session, then iterate.
