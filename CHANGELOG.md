# Changelog

All notable changes to the model and the generator. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates are ISO.

## [Unreleased]

## [1.2.0] - 2026-10-29

### Changed
- The timeline card becomes "Plan y fechas": it plans the 25 diagram activities instead of phases, with editable min/max days, activities marked done with their real date, fast and slow scenarios in separate columns, and the critical path. Each activity has `duration` and `after` in `diagram.json` (first publication 24–127 days).

### Added
- "Roadmap" tab: executive view of the same plan with progress, status counts (done, in progress, pending, late against today), estimated end, a Gantt by stage with milestones and today's line, and lists of what was done, what comes in the next 30 days and what is late. Printable to PDF.
- `plan` and `extra_activities` in `instance.json` to adjust days, mark done activities and add client-only activities; checked by `validate.py` and listed in the client diff.

### Removed
- `schedule()` in `build.py`: the plan is computed in the page from the activities.

## [1.1.0] - 2026-10-29

### Added
- `starter-kit/`: domain-neutral prompt, method reference and templates (AI guide, instance, client README, session, open points, internal decisions, regulatory profile) to replicate the approach in another domain with any AI assistant.
- Timeline with dates: the "Cuánto tarda" card takes a start date (saved per client) and shows when each phase ends in the fast and slow scenario, plus the estimated first publication. Phases run in parallel where step dependencies allow (first publication 24–131 days instead of the sequential 26–141).
- Optional `start_date` in `instance.json`, checked by `validate.py`.

## [1.0.2] - 2026-10-22

### Fixed
- Validation row 31: the Google Play financial features declaration is required for every published app, not only financial ones; source moved to `answer/13849271`. Note added to S12.7.
- `check_sources.py` hashed a hidden per-request id on support.google.com, so every Google page was reported as changed on each run; the hidden `data-page-data-key` blocks are now stripped before hashing.

## [1.0.1] - 2026-10-22

### Added
- Apache License 2.0 (`LICENSE`, `NOTICE`).
- Initial reference of the official sources (`generator/sources_hash.json`).

### Changed
- READMEs: removed the *Origin* section; the date of the last data validation moved next to the source-watch description.

## [1.0.0] - 2026-10-22

### Added
- Base model: 31 roles in 7 lanes, 24 platforms, 27 credentials, 26 artifacts, 19 phases / 107 steps, 14 variation points, 25 renewals, 10 tracking milestones with 27 checks, 25-activity swimlane diagram.
- Client instance layer (`clients/<id>/instance.json`) with lanes, variants, renewal dates and decisions; `clients/example/` as template.
- Generator: interactive page (flow, version tracking, model explorer, instantiation, renewals), static SVG/PNG swimlane diagram, per-client diff.
- Editable draw.io swimlane diagram (`dist/swimlanes.drawio`, `dist/clients/<id>/swimlanes-<id>.drawio`), built from the same layout as the SVG.
- `validate.py` fails if a real client instance is in the git index.
- `generator/validate.py` (IDs and cross-references), `generator/check_sources.py` (official-page watch), `generator/i18n/es.json` (UI strings).
- Docs: model overview, conventions, decisions, data validation against official sources (36 rows), deployment.
- Claude Code skills: `instantiate-client`, `edit-model`, `validate-requirements`.
- GitHub Actions: validation on every pull request to `main`; monthly source watch that opens an issue.
- Optional GitHub Pages workflow in `docs/github-pages/`, not enabled by default.

### Changed
- Repository restructured to English (folders, file names, JSON keys, code, docs). Model content stays in Spanish, declared with `lang: "es"`.
- Enum values normalised: `platform` → `ios|android|both`, `frequency` → `owner|app|version|cycle`, `severity` → `high|medium`.
- Data correction: Apple allows one distribution certificate per type per team (not "max 3").
- Data correction: Play upload key must expire after 2033-10-22.

### Fixed
- Home door "Seguir una versión" pointed to a non-existent tab id.
