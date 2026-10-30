# Changelog

All notable changes to the model and the generator. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates are ISO.

## [Unreleased]

### Changed
- **Incompatible with 2.0.0:** one date per activity instead of a fast and a slow scenario. `duration.days` in `diagram.json` is the midpoint of the former range. Instances use `days` and `end`, and `validate.py` rejects `min` and `max`.
- Changing an activity's end date on the page moves what follows, and the roadmap counts, lists and marks it as postponed.
- "Aprueba uso de tiendas y terceros" is followed per platform instead of as a joint activity: each store can be approved at a different moment.

## [2.0.0] - 2026-10-30

### Added
- Step S1.7 "Reunir los datos de registro de las cuentas", required by S2.1 and S2.4.
- Activity "Crea las cuentas de desarrollador" (L2, S2): S2.1 and S2.4 are run by A05 and A06; A03 and A04 answer for them.
- Activity "Crea la app en tiendas" (L2, S5), after "Registra App IDs por target".
- Activity "Custodia y entrega credenciales" (L4, S6), after "Emite certificados y perfiles".
- V15 "Plataformas objetivo" (iOS and Android, only iOS, only Android). With one platform, the page leaves out the steps, activities, milestone checks, renewals and variants of the other, and the diagrams dim its boxes.
- Follow-up per platform: `platform` and `joint` on each activity, and `plan.<key>.platforms` in instances for `done`, `min`, `max` and `blocked`. The plan keeps one date path per platform, with joint activities as meeting points.
- Roadmap views Conjunto, iOS and Android, with progress, blocker, next activity and the gap at the next meeting point.
- `arrows` in `diagram.json`: the links drawn on the diagram, checked by `validate.py`.

### Changed
- **Incompatible with 1.3.0:** activities have a stable `key`, and the number shown is computed from the position, in flow order. `after`, `arrows`, `plan` and `extra_activities` use keys. `validate.py` rejects instances that use numbers; `docs/decisions.md`, row 23, has the table from number to key. A plan stored in a browser is discarded once.
- "Acepta acuerdos e invita a TI" and "Configura roles y accesos" merge into "Invita usuarios y asigna roles" (L2, 2–5 days). S3.1 and S3.2 move to the account activity, because the stores ask for them while the account is created: S3.1 now comes before S2.3, and S3.2 before S2.6.
- "Gestiona D-U-N-S, poderes y pagos" becomes "Reúne datos legales y de contacto".
- "Define IDs y crea la app en tiendas" moves to L2 and becomes "Define Bundle ID y package name". S5.1 goes to A05 and A06, consulting A09 and validated by A07; S5.3 to A05 and S5.4 to A06.
- "Genera y custodia claves de firma" becomes "Genera claves de firma" (1–2 days); custody, handover and the credential inventory move to the new activity.
- S6.13 depends on S7.2: fingerprints are registered once the Firebase project exists.
- S11.3 depends on S8.4, and S11.4 has a note with the same rule: no build reaches external testers without its security analysis.

### Fixed
- Client pages opened as local files shared one browser storage, so one client's name and plan appeared on another client's page or on the base page. Each client page now stores its data under its own keys and moves its earlier data there.
- A client page opened before a rebuild kept the stored plan and ignored changes to `plan` in `instance.json`. Now it adopts them and keeps only the activities edited on the page since the previous build.

## [1.3.0] - 2026-10-29

### Changed
- Each client's page, diagrams and diff are written to `clients/<id>/dist/` (`index.html`, `swimlanes.svg`, `swimlanes-<id>.drawio`, `swimlanes.png`, `diff.md`) instead of `dist/clients/<id>/` and `dist/diff-<id>.md`. A private client folder now holds its documents and its output together. `validate.py` flags anything left tracked under the old paths.

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
