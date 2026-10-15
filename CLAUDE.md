# Guide for the AI

This repository is a data model, not an application. Read only what the task needs.

## What to read for each task

| Task | Read | Do not read |
| --- | --- | --- |
| Understand the model | `docs/model.md` | `model/steps.json` in full |
| Add or change a step, role, credential, variant | `docs/conventions.md` and the JSON being changed | `generator/`, `dist/` |
| Instantiate a client | `.claude/skills/instantiate-client/SKILL.md`, `clients/example/instance.json`, `model/variants.json`, `model/actors.json` (only `lanes`) | `model/steps.json` |
| Validate store data | `.claude/skills/validate-requirements/SKILL.md`, `docs/validation.md` | everything else |
| Change how the page looks or behaves | `generator/build.py`, `generator/templates/`, `generator/i18n/es.json` | `model/` |
| Answer why something was decided | `docs/decisions.md` | everything else |

## Rules

1. **`model/` is the source.** Never edit `dist/`. After changing `model/` or `clients/`, run `python3 generator/validate.py && python3 generator/build.py --no-png` and confirm there are no errors.
2. **Stable IDs.** IDs (A01, S6.2, V14, R12) are referenced across files and from external documents. Never renumber. A new element takes the next free ID; a removed one leaves its ID unused.
3. **Neutrality.** The base model names no clients, companies, countries or regulators. That belongs in `clients/<id>/instance.json` or in a regulatory profile.
4. **Variants, not defaults.** Where there are alternative ways to do something, model it as an option of a variant. No option is "the normal one".
5. **Dated data.** Every store deadline, limit or cost has a source and a date in `docs/validation.md`. If you change one, update that table.
6. **Two languages, one rule.** Repository in English: file names, JSON keys, code, comments, docs, skills, commits. Model content in Spanish: JSON *values* (names, notes, descriptions), UI strings in `generator/i18n/es.json`, `docs/validation.md` table rows. Never translate content values to English; never write Spanish keys, identifiers or code comments.
7. **Enums in English.** `platform` is `ios` / `android` / `both`; `frequency` is `owner` / `app` / `version` / `cycle`; `severity` is `high` / `medium`. Their display labels live in `model/phases.json` (`frequencies`) and `generator/i18n/es.json`.

## ID structure

| Prefix | Entity | File |
| --- | --- | --- |
| A | Actor (role) | `model/actors.json` |
| L | Lane (area) | `model/actors.json` |
| P | Platform or console | `model/platforms.json` |
| C | Credential | `model/credentials.json` |
| F | Artifact | `model/artifacts.json` |
| S | Phase (S0–S18) and step (S6.2) | `model/phases.json`, `model/steps.json` |
| V | Variation point | `model/variants.json` |
| R | Renewal | `model/renewals.json` |
| m / c | Milestone and per-version check | `model/milestones.json` |

## Commands

```bash
python3 generator/validate.py                 # syntax, IDs, cross-references (run before every commit)
python3 generator/build.py --no-png           # fast build
python3 generator/build.py                    # with PNG (needs playwright)
python3 generator/check_sources.py            # did any cited official page change?
python3 generator/check_sources.py --update   # after validating, store the new reference
```

## Repository map

```
model/             source of truth (10 JSON files, English keys, Spanish values)
clients/<id>/      instance.json per client (example/ is the template)
generator/         build.py, validate.py, check_sources.py, templates/ (page HTML + JS), i18n/ (UI strings)
dist/              generated: index.html, swimlanes.svg/.png, clients/<id>/, diff-<id>.md
docs/              model.md, conventions.md, decisions.md, validation.md, deployment.md
.claude/skills/    instantiate-client, edit-model, validate-requirements
.github/workflows/ build.yml (Pages), check-sources.yml (monthly source watch)
```
