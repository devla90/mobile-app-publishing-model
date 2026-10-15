# Contributing

Thanks for helping keep the model accurate. Small, well-sourced changes are the most useful ones.

## Before you start

- Read [docs/model.md](docs/model.md) (one page) and [docs/conventions.md](docs/conventions.md).
- Check [docs/decisions.md](docs/decisions.md): some things are the way they are on purpose.

## Language

- **English:** file names, JSON keys, code, comments, commit messages, issues, docs, skills.
- **Spanish:** model content (JSON values), UI strings in `generator/i18n/es.json`, and the data rows of `docs/validation.md`.

A pull request that translates content values to English, or adds Spanish keys or identifiers, will be asked to change.

## Making a change

1. Edit the JSON in `model/` (or `clients/<id>/instance.json`). Never edit `dist/`.
2. Run the checks:

   ```bash
   python3 generator/validate.py
   python3 generator/build.py --no-png
   ```

3. If the change touches a store deadline, limit, cost or date, add or update the row in `docs/validation.md` with the **official** URL (`developer.apple.com`, `support.google.com`, `developer.android.com`) and today's date. Blog posts and forums do not count as sources.
4. If the change alters how the model is interpreted (a new variant, a merged role, a removed entity), add a row to `docs/decisions.md`.
5. Open a pull request. Describe *what* changed and *why* in one paragraph; link the source if there is one.

## What is welcome

- Corrections to data points, with source.
- New steps, credentials or renewals that apply to any publisher, not one company.
- New options for existing variants.
- New UI languages (`generator/i18n/<lang>.json`).
- Regulatory profiles (`profiles/PR-<SECTOR>-<COUNTRY>.json`, see "Decisions still open" in `docs/decisions.md`).

## What is not

- Client-specific content in `model/`. That goes in a client instance.
- Marking any variant option as the default or recommended one.
- Renumbering IDs.
- Real client instances with internal information in a public fork.

## Commit messages

Imperative, English, one line, optionally scoped: `steps: add S7.4 App Attest key`, `validation: update target API row (2026-11)`, `i18n: fix typo in ren_intro`.
