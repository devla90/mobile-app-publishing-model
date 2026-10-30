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
3. If the step is new to the swimlane diagram, check whether an activity in `diagram.json` already covers it. If not, do not add it to the diagram: the activities are a summary, not a mirror.
4. If it introduces a new credential or artifact, create that first with its ID.
5. If it repeats per version, check whether a check in `milestones.json` should link to it.
6. Run `python3 generator/validate.py && python3 generator/build.py --no-png` and open the page to see the step in its phase.

### Adding a variant

1. ID `V<next>`. Name phrased as a decision ("Dónde se compila").
2. Options with `key` (letter) and `text`. No "default" or "recommended" in the text.
3. Mark the variant on every step that changes with the option (`variants` in `steps.json`).

`platform` on a variant is optional and means the point only exists for that platform (V4, V5, V6, V8). V15 is the exception to marking steps: it acts through the `platform` of every step and activity, so it is not listed in `variants` on steps.

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

The plan works on the diagram activities, not on phases. Each activity in `diagram.json` has `duration.days` in calendar days and `after`, the activities that must finish before it starts. The activities of the last stage are `continuous` and have no duration. `validate.py` checks that durations are whole days, that every `after` exists and that there are no cycles.

The page computes one date per activity and marks the critical path. To postpone an activity, change its end date on the page: what follows moves by itself, and the roadmap counts and lists it as postponed against the plan without changes. Phase durations in `phases.json` remain as a reference in the step view.

An instance may set:

- `start_date` (`YYYY-MM-DD`): day 0 of the plan.
- `plan`: per activity key, `days`, `end` (the date it now ends), `after` (replaces the base list) and `done` (`true`, meaning finished at `start_date`, or the real date). A finished activity ends on that date and its dependants start from there.
- `extra_activities`: the client's own activities, with `id` (not a key used by the model), `name`, `lane`, `days` and `after`. They chain with the model's activities, and a base activity can wait for them through `plan.<n>.after`.

### Activity keys and numbers

Each activity has a `key`, a stable English slug such as `create-store-app`. `after`, `arrows` and instances use the key. The number people see is computed from the position in `diagram.json`, so the diagram always reads in flow order.

To add an activity, insert it where it belongs in `activities` with a new key, and add its arrows. Nothing else changes: numbers move by themselves, and instances keep working because their keys do not. Never reuse or rename a key: to retire an activity, remove it, and `validate.py` lists the instances that still use it.

Prefer a step inside an existing activity before adding one: the diagram is a summary. UI strings that name an activity use `{act:<key>}`, which the build turns into its number. Documents written by hand should cite the activity by name, because its number can change.

`arrows` in `diagram.json` is a readable summary of the dependencies, not all of them; the plan uses `after`. `PLAN_V` in `page_logic.js` only changes if the format of stored plans changes.

Instances from version 1.3.0 use numbers, and `validate.py` rejects them. Replace each number with its key, using the table in `docs/decisions.md`, row 23.

### Platforms

Each activity in `diagram.json` has `platform` (`ios`, `android`, `both`) and `joint`. A `joint` activity has one state and waits for every platform: it is a meeting point, such as a shared approval. The others run once per platform, so one platform can move ahead of the other. An activity that does not apply to a platform is skipped for it, and what comes next waits for what that activity waited for.

V15 chooses the targets. With `b` or `c`, the page leaves out what belongs to the other platform: steps, activities, milestone checks, renewals and variants; the diagrams keep the box dimmed. Without V15 and without `platforms` in the plan, the page shows one plan, as it did before.

An instance follows each platform with `plan.<key>.platforms.<ios|android>`, which accepts `done`, `days`, `end` and `blocked` (a text for the roadmap). `done` at the activity level means finished on every platform. `extra_activities` accept `platform` (default `both`) and `joint` (default `true`).

The roadmap then has three views: Conjunto, iOS and Android. In Conjunto an activity counts as done only when every platform it applies to has finished it, so that percentage is not the average of the other two.

The base model never gets client activities; that keeps it neutral. Edits made on the page are stored per client in the browser or the artifact database; to make them permanent, copy them into `instance.json`. After a rebuild, the page adopts the new `plan` from `instance.json` and keeps only the activities edited on the page since the previous build.
