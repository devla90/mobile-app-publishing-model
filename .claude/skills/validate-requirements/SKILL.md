---
name: validate-requirements
description: Check the model's data points with deadlines, limits, costs or dates against Apple's and Google's official pages, update docs/validation.md and fix the JSON if anything changed. Use when asked to validate, refresh or verify store requirements, or at the start of each quarter.
---

# Validate requirements against official sources

## What to read

- `docs/validation.md`: this is the work list. Every row has the data point, where it is used and the URL.
- Nothing else until a change is found.

## Procedure

1. **News first.** Open and summarise what is new since the "Last full validation" date:
   - https://developer.apple.com/news/upcoming-requirements/
   - https://developer.apple.com/news/
   - https://support.google.com/googleplay/android-developer/answer/11926878 (target API)
   - https://android-developers.googleblog.com/
   - https://developer.apple.com/support/expiration/
2. **Row by row.** For each row of `docs/validation.md`, open the source with WebFetch and compare the data point. Only `developer.apple.com`, `support.google.com`, `developer.android.com`, `android-developers.googleblog.com`, `play.google.com` count. Third-party blogs are grounds for suspicion, not confirmation.
3. **If the source moved**, find the equivalent page on the same domain and update the URL in the table.
4. **If the data point changed:**
   - Fix the JSON in `model/` where it is used (the "Used in" column says which: C06 → `credentials.json`, R21 → `renewals.json`, S8 → `phases.json` or `steps.json`). The content value stays in Spanish.
   - Set the status to `CORRECTED (<date>: previously …)`.
   - Add a row to `docs/decisions.md` with the correction and a line under `[Unreleased]` in `CHANGELOG.md`.
5. **If a new requirement appears** with an effective date (new minimum SDK, new mandatory declaration, new verification process): add it as a new row in the table and, if it implies per-version work, as a renewal `R<next>` with `cycle_months: 0` or as a note on the affected step. Use the `edit-model` skill for that.
6. **Date.** Update "Last full validation" to today only if every row was reviewed. If partial, note it below: "Partial validation <date>: rows 14–16, 29".
7. **Reference hashes.** Run `python3 generator/check_sources.py --update` so the monthly action compares against the pages as they are now.
8. **Report.** Return a short list: rows confirmed (count), rows corrected (what changed), new requirements, broken URLs. If nothing changed, say so in one line.

## What is not done

- A data point is never "confirmed" from a secondary source or prior knowledge: if the official page does not say it, the status is `NO SOURCE`.
- A deadline in the model is never changed without touching the table, nor the table without touching the model.
