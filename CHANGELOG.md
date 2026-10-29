# Changelog

All notable changes to the model and the generator. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates are ISO.

## [Unreleased]

### Added
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
