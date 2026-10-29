# Conventions for editing the model

## Language

Two languages, one boundary:

| In English | In Spanish |
| --- | --- |
| Folder and file names | JSON **values** that are model content: `name`, `note`, `description` of roles/lanes, `risk`, `text`, `if_expired`, `renewed_by`, `group`, `lines` |
| JSON **keys** and enum values (`ios`, `both`, `owner`, `high`) | UI strings in `generator/i18n/es.json` |
| Code, comments, CLI flags, console output | Data rows of `docs/validation.md` |
| `README.md`, `docs/`, skills, workflows, commits | `README.es.md` |

Every data file declares `"lang": "es"` at the top. The top-level `description` of each file is for maintainers and is in English.

Adding a UI language: create `generator/i18n/<lang>.json` with the same keys as `es.json` and build with `python3 generator/build.py --lang <lang>`. The model content is not translated by this; a bilingual model would move values to `locales/<lang>/` (open decision, see `docs/decisions.md`).

## File format

Every file in `model/` has `description`, `lang` and then the data. Every element has a stable ID that other files reference.

### `steps.json`

```json
{
  "id": "S6.2",
  "phase": "S6",
  "name": "Emitir certificado Apple Distribution",
  "platform": "ios",
  "owner": "A03 o A05",
  "inputs": "F01",
  "outputs": "F02, C06",
  "depends_on": ["S6.1", "S4.2"],
  "variants": ["V4"],
  "note": "Solo Account Holder o Admin pueden crearlo."
}
```

- `platform`: `ios`, `android` or `both`.
- `owner`: free text with role IDs inside (`A03 o A05`, `A14 → A30`). The page extracts `A\d\d` to link them.
- `inputs` and `outputs`: free text with `C` and `F` IDs inside, or a short description if there is no formal artifact.
- `depends_on`: list of existing step IDs. "Cannot start without the output of". Empty if it can start whenever decided.
- `variants`: `V` IDs that change how the step is executed.
- `note`: optional. What an operator must know that does not fit in the name.

### Adding a step

1. Pick the phase. The ID is `<phase>.<next number>`. Do not reorder existing ones.
2. Add the object to `steps.json` in ID order.
3. If the step is new to the swimlane diagram, check whether an activity in `diagram.json` already covers it. If not, do not add it to the diagram: the 25 activities are a summary, not a mirror.
4. If it introduces a new credential or artifact, create that first with its ID.
5. If it repeats per version, check whether a check in `milestones.json` should link to it.
6. Run `python3 generator/validate.py && python3 generator/build.py --no-png` and open the page to see the step in its phase.

### Adding a variant

1. ID `V<next>`. Name phrased as a decision ("Dónde se compila").
2. Options with `key` (letter) and `text`. No "default" or "recommended" in the text.
3. Mark the variant on every step that changes with the option (`variants` in `steps.json`).

### Adding a role

1. ID `A<next>`. Assign it to a lane in `actors.json` (`roles.<id>.lane` **and** the lane's `roles` list).
2. If it creates a segregation conflict with another role, add it to `incompatible_pairs`.

### Adding a renewal

1. ID `R<next>`. `cycle_months` 0 means event- or policy-driven.
2. `lead_days` is how far ahead to warn. `if_expired` explains the effect in one sentence.
3. `step` points to the step that performs it.

## Style

- Step names in infinitive or third person, short: "Emitir certificado", "Verifican la entidad".
- No unexplained acronyms in `docs/` the first time. In `model/` they are fine (CSR, IPA, AAB, APNs).
- Dates in ISO (`2026-10-14`). Durations in calendar days.
- Business-facing text (diagram, milestones) in plain language; technical text in the steps.

## Minimum validation before commit

```bash
python3 generator/validate.py
python3 generator/build.py --no-png
```

`validate.py` checks JSON syntax, that every `depends_on`, `variants`, `step`, `lane` and role reference exists, that enums are valid, and that client instances only use known lanes, variants and renewals and a valid `start_date`.

## Durations and the timeline

`duration.min` and `duration.max` of each phase in `phases.json` are calendar days. The page orders phases by the `depends_on` of their steps: a phase starts when the earlier phases it depends on have finished; a dependency on a later phase is read as overlap and ignored. A phase with `max` 0 is continuous and left out. Changing a duration or a step dependency changes the estimated dates; check the "Cuánto tarda" card after the build.

An instance may set `start_date` (`YYYY-MM-DD`); the client's page then shows the end date of each phase and the estimated first publication.
