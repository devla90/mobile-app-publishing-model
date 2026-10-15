---
name: edit-model
description: Add, change or retire a step, role, credential, artifact, variant, renewal or milestone in model/*.json while respecting stable IDs, dependencies, neutrality and the language rule (English keys, Spanish content). Use when asked to modify the base model.
---

# Edit the base model

## What to read

- `docs/conventions.md` (file formats, language rule, style).
- Only the JSON that changes. For a step, also the phase in `model/phases.json` to confirm the prefix.
- If the edit changes a store deadline, limit or cost: the matching row in `docs/validation.md`.

Do not load `model/steps.json` in full to add one step: `grep '"id": "S6\.'` the steps of the phase and read only those.

## Procedure

1. **Confirm which entity changes** (A, P, C, F, S, V, R, m/c) and which file it lives in (table in `CLAUDE.md`).
2. **ID.** New = next free. Retired = remove the object but never reuse the ID; note in `docs/decisions.md` that it is free. Never renumber.
3. **Language.** Keys, enum values and comments in English. Content values (`name`, `note`, `text`, `risk`, `if_expired`, lane `description`…) in Spanish. If the request arrives in English, write the content value in Spanish anyway and say so.
4. **Neutrality.** No company, country, regulator or client-product names. If the request comes from one client, model the generic case and suggest the detail goes in its `instance.json`.
5. **Variants, not defaults.** If the request is "replace X with Y" and both are valid, do not replace: add Y as an option of an existing or new variant and mark the affected steps.
6. **Cross-references.** When adding or retiring:
   - a step: check `depends_on` of other steps, `step` in `milestones.json` and `renewals.json`, and `phases` in `diagram.json`.
   - a credential or artifact: grep its ID in `steps.json` (`inputs`/`outputs`).
   - a role: grep `A\d\d` in `owner` of `steps.json`, the lane's `roles` list and `incompatible_pairs`.
   - a variant: grep its ID in `variants` of `steps.json`.
7. **Dated data.** If the change includes a store figure (days, count, cost, date), add or update the row in `docs/validation.md` with the official URL and today's date.
8. **Record the decision** in `docs/decisions.md` if the change alters how the model is interpreted (not for wording fixes).
9. **Validate and build:**

   ```bash
   python3 generator/validate.py
   python3 generator/build.py --no-png
   ```

   Open `dist/index.html` and check the tab where the change lives (Explorar el modelo, Ver el flujo or Renovaciones).
10. **Shared artifact.** If the team uses the Claude artifact, remind the user it must be regenerated (`docs/deployment.md`).
11. **Changelog.** Add a line under `[Unreleased]` in `CHANGELOG.md`.

`validate.py` reports broken `depends_on`, unknown variants, roles, credentials, artifacts, lanes and phases, invalid enums, and instance files that reference unknown IDs.
