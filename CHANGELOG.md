# Changelog

All notable changes to the model and the generator. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates are ISO.

## [Unreleased]

## [1.0.0] - 2026-10-14

### Added
- Base model: 31 roles in 7 lanes, 24 platforms, 27 credentials, 26 artifacts, 19 phases / 107 steps, 14 variation points, 25 renewals, 10 tracking milestones with 27 checks, 25-activity swimlane diagram.
- Client instance layer (`clients/<id>/instance.json`) with lanes, variants, renewal dates and decisions; `clients/example/` as template.
- Generator: interactive page (flow, version tracking, model explorer, instantiation, renewals), static SVG/PNG swimlane diagram, per-client diff.
- `generator/validate.py` (IDs and cross-references), `generator/check_sources.py` (official-page watch), `generator/i18n/es.json` (UI strings).
- Docs: model overview, conventions, decisions, data validation against official sources (36 rows), deployment.
- Claude Code skills: `instantiate-client`, `edit-model`, `validate-requirements`.
- GitHub Actions: build and publish to Pages; monthly source watch that opens an issue.

### Changed
- Repository restructured to English (folders, file names, JSON keys, code, docs). Model content stays in Spanish, declared with `lang: "es"`.
- Enum values normalised: `platform` → `ios|android|both`, `frequency` → `owner|app|version|cycle`, `severity` → `high|medium`.
- Data correction: Apple allows one distribution certificate per type per team (not "max 3").
- Data correction: Play upload key must expire after 2033-10-22.

### Fixed
- Home door "Seguir una versión" pointed to a non-existent tab id.
