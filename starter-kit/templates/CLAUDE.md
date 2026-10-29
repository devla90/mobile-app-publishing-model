# Guide for the AI

This repository is a data model of <process>, not an application. Read only what the task needs.

## What to read for each task

| Task | Read | Do not read |
| --- | --- | --- |
| Understand the model | `docs/model.md` | `model/steps.json` in full |
| Add or change a step, role, credential, variant | `docs/conventions.md` and the JSON being changed | `generator/`, `dist/` |
| Instantiate a client | `docs/procedures/instantiate-client.md`, `clients/example/instance.json`, `model/variants.json`, `model/actors.json` (only `lanes`) | `model/steps.json` |
| Validate external data | `docs/procedures/validate-requirements.md`, `docs/validation.md` | everything else |
| Change how the page looks or behaves | `generator/build.py`, `generator/templates/`, `generator/i18n/<lang>.json` | `model/` |
| Answer why something was decided | `docs/decisions.md` | everything else |

## Rules

1. **`model/` is the source.** Never edit `dist/`. After changing `model/` or `clients/`, run `python3 generator/validate.py && python3 generator/build.py --no-png` and confirm there are no errors.
2. **Stable IDs.** IDs are referenced across files and from external documents. Never renumber. A new element takes the next free ID; a removed one leaves its ID unused.
3. **Neutrality.** The base model names no clients, companies, countries or regulators. That belongs in `clients/<id>/instance.json` or in a regulatory profile.
4. **Variants, not defaults.** Where there are alternative ways to do something, model it as an option of a variant. No option is "the normal one".
5. **Dated data.** Every external deadline, limit or cost has a source and a date in `docs/validation.md`. If you change one, update that table.
6. **Two languages, one rule.** Repository in <repo-lang>: file names, JSON keys, code, comments, docs, commits. Model content in <content-lang>: JSON values (names, notes, descriptions), UI strings in `generator/i18n/<lang>.json`, `docs/validation.md` table rows.
7. **Enums in <repo-lang>.** <list enums and their values>. Their display labels live in the data files or the i18n file.

## ID structure

| Prefix | Entity | File |
| --- | --- | --- |
| A | Actor (role) | `model/actors.json` |
| L | Lane (area) | `model/actors.json` |
| P | Platform or system | `model/platforms.json` |
| C | Credential | `model/credentials.json` |
| F | Artifact | `model/artifacts.json` |
| S | Phase (S0–Sn) and step (S3.2) | `model/phases.json`, `model/steps.json` |
| V | Variation point | `model/variants.json` |
| R | Renewal | `model/renewals.json` |
| m / c | Milestone and per-cycle check | `model/milestones.json` |

## Commands

```bash
python3 generator/validate.py                 # syntax, IDs, cross-references (run before every commit)
python3 generator/build.py --no-png           # fast build
python3 generator/check_sources.py            # did any cited official page change?
python3 generator/check_sources.py --update   # after validating, store the new reference
```

## Repository map

```
model/             source of truth
clients/<id>/      instance.json per client (example/ is the template; real ones are symlinked from private repos)
generator/         build.py, validate.py, check_sources.py, templates/, i18n/
dist/              generated
docs/              model.md, conventions.md, decisions.md, validation.md, deployment.md, procedures/
.github/workflows/ validate.yml (PR check), check-sources.yml (monthly source watch)
```
