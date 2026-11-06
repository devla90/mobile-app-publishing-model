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
- `applies_if`: optional, `{ "<V id>": "<option key>" }` for a step that exists only with that option, such as S5.5 (transfer an app from another account) with V11 b. A client that chose another option does not see the step: its sheet names it under "No aplican en este cliente". Without a choice, the step shows. The variant must also be in `variants`.
- `note`: optional. What an operator must know that does not fit in the name.

### Adding a step

1. Pick the phase. The ID is `<phase>.<next number>`. Do not reorder existing ones.
2. Add the object to `steps.json` in ID order.
3. Add its ID to the `steps` of the activity in `diagram.json` that covers it. Every step belongs to exactly one activity, of a phase and platform that fit it; `validate.py` checks it. Only if no activity covers it, consider a new one: the activities are a summary, not a mirror.
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
- Dates in ISO (`2026-10-14`). Durations in working days, except activities marked `"calendar": "calendar"`, which run every day.
- Business-facing text (diagram, milestones) in plain language; technical text in the steps.

## Minimum validation before commit

```bash
python3 generator/validate.py
python3 generator/build.py --no-png
```

`validate.py` checks JSON syntax, that every `depends_on`, `variants`, `step`, `lane` and role reference exists, that enums are valid, and that client instances only use known lanes, variants and renewals and a valid `start_date`.

## Durations and the timeline

The plan works on the diagram activities, not on phases. Each activity in `diagram.json` has `duration.days` in working days and `after`, the activities that must finish before it starts. The activities of the last stage are `continuous` and have no duration. `validate.py` checks that durations are whole days, that every `after` exists and that there are no cycles.

The page computes one date per activity and marks the critical path. It forecasts from today: an open activity whose end has passed is taken to end today, keeps its "late" status, and what follows moves with it, so the end of the plan is never earlier than reality allows. An end date before the activity can start, after its predecessors, is refused. The deviation and the expected progress are measured against the plan as written, without that forecast. "Today" is the local date of the computer. The list shows the duration of every pending activity under its dates ("5 días lab." or "13 días corridos"), counted between its current start and end. To record that an activity started later than its predecessors allowed (the real start, or the earliest date it may start), set its **start** on the page: it moves without changing its duration, and what follows moves with it. A start before its predecessors end is refused. To postpone an activity, what follows moves by itself, and the roadmap counts and lists it as postponed against the plan without changes. Phase durations in `phases.json` are reference data for whoever estimates a new activity; the page does not show them, so every date comes from the activities.

An instance may set:

- `start_date` (`YYYY-MM-DD`): day 0 of the plan.
- `plan`: per activity key, `days`, `end` (the date it now ends), `after` (replaces the base list) and `done` (`true`, meaning finished at `start_date`, or the real date). A finished activity ends on that date and its dependants start from there.
- `extra_activities`: the client's own activities, with `id` (not a key used by the model), `name`, `lane`, `days` and `after`. They chain with the model's activities, and a base activity can wait for them through `plan.<n>.after`.

### Postponements

Every postponement says why. Next to a `start` or an `end` set by hand (`plan.<key>.start`, `plan.<key>.end`), at the activity level or per platform, `reason` holds `{ "type": "external" | "dependency" | "decision" | "team" | "scope" | "other", "note": "<text>" }`: an external blocker (a store, a provider), another activity, a pending decision, team availability, a change of scope, or something else. The note is optional. When an end date is changed, the page asks for both; a note without a category counts as `other`, and removing the end removes its reason. `validate.py` rejects a `reason` without a `start` or an `end` in the same entry, or with an unknown type. "Aplazada N días" counts only what the activity's own start or end moved it, not what it inherits from activities before it. The roadmap shows the reason in the bar's tooltip and in the list of postponed activities, its summary names the most frequent one, and the CSV has a column for each.

### Slack

Slack is how many days a pending activity can slip before the end of the plan moves; critical activities have none. It is counted from the successors, so activities of 0 days and activities that end the same day keep the chain; the days a successor waits only because the next day is not a working day are not slack. The CSV has it as a column. In the roadmap schedule the button "Mostrar holgura" draws it as a hatched stretch after each bar, and hides it again; it is off by default, and the choice is kept in that browser.

### Working calendar

Durations are **working days**: by default Monday to Friday, with no holidays. An activity that does not depend on the team's working days, such as the store verifying the entity or reviewing a version, carries `"calendar": "calendar"` and counts every day; client activities accept the same field (for example, a pilot window). A working activity starts on the first working day its predecessors allow and hands over on the next working day after the last one it uses, so it never starts or ends on a weekend or a holiday.

An instance declares its calendar in `calendar`: `{ "workdays": [1, 2, 3, 4, 5], "holidays": [{ "date": "YYYY-MM-DD", "name": "<text>" }], "source": "<official URL>" }`, with 1 for Monday and 7 for Sunday. Holidays belong to the client's country and come with their source; the base model names none. The roadmap draws each holiday as a faint line in the schedule, and `diff.md` lists them. Slack, deviation and postponements are still measured in calendar days between real dates. Without a start date there are no weekdays to look at, so every day counts. `validate.py` checks the weekdays, the dates and names of the holidays and the `calendar` of every activity.

### Activity keys and numbers

Each activity has a `key`, a stable English slug such as `create-store-app`. `after`, `arrows` and instances use the key. The number people see is computed from the position in `diagram.json`, so the diagram always reads in flow order.

To add an activity, insert it where it belongs in `activities` with a new key, and add its arrows. Nothing else changes: numbers move by themselves, and instances keep working because their keys do not. Never reuse or rename a key: to retire an activity, remove it, and `validate.py` lists the instances that still use it.

Prefer a step inside an existing activity before adding one: the diagram is a summary. UI strings that name an activity use `{act:<key>}`, which the build turns into its number. Documents written by hand should cite the activity by name, because its number can change.

`arrows` in `diagram.json` is a readable summary of the dependencies, not all of them; the plan uses `after`. `PLAN_V` in `page_logic.js` only changes if the format of stored plans changes.

Instances from version 1.3.0 use numbers, and `validate.py` rejects them. Replace each number with its key, using the table in `docs/decisions.md`, row 23.

### Client activities

An activity of `extra_activities` may carry `tasks` (texts: what has to be done) and `refs` (IDs of model steps it relates to). `refs` do not move those steps: a step still belongs to exactly one activity, and the sheet shows them apart as related steps. Every activity, of the model or of the client, opens a sheet with its dates and status per platform, blockers, the open decisions that hold it back, and its steps, tasks or related steps.

Where something belongs:

| It happens in | It goes in |
| --- | --- |
| One client only | An activity of that client's `extra_activities`, with `tasks` and `refs` |
| Several clients | The model: an activity with its steps, or an option of a variant |
| One sector or country | The regulatory profile (`PR-<SECTOR>-<COUNTRY>`) |

When the same client activity shows up in a second or third client, move it up instead of copying it.

When a client does a step of the model in another activity of the model, for example because a policy delays it, `step_moves` says where: `{ "<step id>": "<activity key>" }`. The page shows the step in that activity, first, with the note "movido desde la actividad N", and no longer in its own; `diff.md` lists the moves. The step keeps its dependencies; move the activity's `after` in `plan` too if the order changes. `validate.py` rejects an unknown step or activity, a move to where the step already is and a step whose platform does not fit the activity. Only activities of the model are targets; a client activity relates to steps through `refs`.

A conditional step (its `note` starts with "Condicional", such as the ones that apply only if the app charges or is distributed in the EU) that does not apply to a client goes in `step_skips`: `{ "<step id>": "<reason>" }`. The sheet of its activity drops it from the steps and names it, with the reason, under "No aplican en este cliente"; `diff.md` lists them. `validate.py` accepts only conditional steps, requires a reason and rejects a step that is also moved. Steps that depend on a variant option need no entry here: `applies_if` in the model drops them once the client chooses another option.

`notes` keeps what a client needs to know about an activity, shown on its sheet under "Notas del cliente": `{ "<activity key or client id>": ["<paragraph>", ...] }`. Text is escaped; `**text**` is shown in bold. Notes are short and practical (a name that must match a registry, an app that coexists with the new one); long working documents stay outside the instance. `diff.md` lists them. Notes live outside `plan`, so a page edit of the activity never keeps an old copy.

IDs of client activities use a prefix per theme and a number (`PI1` for a pilot run, `ST1` for waiting on a store access), never the prefix of the client's decisions (`D`) or open points (`O`): an activity that waits for decision D1 is not decision D1. `validate.py` rejects an activity with the id of an open decision.

### Milestones

Roadmap milestones are not the version checkpoints of `milestones.json` (m1–m10, "controles" on the page), which track each release. An activity can carry `milestone`: `{ "name": "<text>", "type": "achievement" | "decision" }`. Achievements mark that something is ready; decisions mark that someone has to approve. The roadmap draws one diamond per platform at the date the activity ends, lists the next ones and shows the next milestone in its summary. Instances add their own on `extra_activities`, and can rename the milestone of a model activity with `plan.<key>.milestone` (same form) or remove it with `null`, for example when a client activity of their own already marks that moment. The model keeps its milestones; `diff.md` lists the change. The base model marks only what business asks about: verified account, app created, first signed build, QA sign-off, security approval, Go / No-Go, store approval (the day the app becomes visible) and available to every user (the end of the release, after any staged rollout).

### Decisions, areas and baseline

An instance may list `open_decisions`: `{ "id", "name", "owner", "opened", "due", "status", "platform", "blocks": [activity keys] }`, the decisions that hold the plan back. The roadmap shows them first, with the days they have been open and whether they are overdue. `decisions` stays as the log of what was decided.

`risks` lists what may still happen and would move the plan: `{ "id", "name", "severity": "high" | "medium", "owner", "mitigation", "affects": [activity keys], "platform", "status": "open" | "closed" }`. A risk is not a decision that is already holding the plan back (that is an open decision) nor a blocker (that is `blocked`); it is something that has not happened yet, such as a store review that slows down in December. The committee view names the open high risks; the detail lists every open one, high first, with its mitigation, and the sheet of each affected activity shows them too. `platform` and `status` are optional (`open` by default). IDs use their own prefix (`RG1`), different from decisions, open points and client activities; `validate.py` rejects a repeated one. There is no probability and impact score and no catalogue in the base model: one severity, an owner and a mitigation are what a committee acts on.

`baseline` holds the committed start and end of each activity: `{ "<key>": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" } }`, or `"<key>@ios"` per platform. Both dates are written: a start deduced from the current duration would move whenever someone changed it. `validate.py` rejects any other form and a start after the end; an activity added after the approval may have no entry. The roadmap draws it as a thin bar under each activity of the schedule, marks it next to each milestone and shows the largest deviation in its summary. The button "Copiar plan como línea base" copies the current start and end of every activity in that format; paste it when the plan is approved and do not change it afterwards.

"Exportar CSV", on the plan and on the roadmap, writes one row per activity and platform: area, platform, start and end, duration and its kind of days (working or calendar), status, real and expected progress, the reference end and the deviation in days, milestone, blocker, decisions, days postponed by hand and their reason, critical path, slack and steps. Real progress is what is done (0 or 100); expected progress is the share of the committed period already gone, so a gap between both shows a risk before the due date. Without a baseline the reference is the plan without page edits, and the file says so. The first rows record the client, the date, the start date and whether the data includes changes held only in that browser; with such changes the page asks whether to export the official plan or those changes. The file uses semicolons and UTF-8 so Excel in Spanish opens it in columns.

The roadmap opens with what a committee needs: the summary (its publication date is the day the app becomes visible in the stores, the start of the release, with the end of the staged rollout below it), a block "Para decidir y vigilar" with one line per open decision (owner and due date) and per high risk (owner), and the milestones. The rest is under "Detalle para la gestión", schedule first: progress per platform, the schedule, the full tables of open decisions and risks (folded, with their counts in the title), open work by area, the lists and the history of the plan (folded). A line of the block opens the detail at its table.

### Platforms

Each activity in `diagram.json` has `platform` (`ios`, `android`, `both`) and `joint`. A `joint` activity has one state and waits for every platform: it is a meeting point, such as a shared approval. The others run once per platform, so one platform can move ahead of the other. An activity that does not apply to a platform is skipped for it, and what comes next waits for what that activity waited for.

V15 chooses the targets. With `b` or `c`, the page leaves out what belongs to the other platform: steps, activities, milestone checks, renewals and variants; the diagrams keep the box dimmed. Without V15 and without `platforms` in the plan, the page shows one plan, as it did before.

An instance follows each platform with `plan.<key>.platforms.<ios|android>`, which accepts `done`, `days`, `end`, `reason` and `blocked` (a text for the roadmap). `done` at the activity level means finished on every platform. `extra_activities` accept `platform` (default `both`) and `joint` (default `true`).

The roadmap then has three views: Conjunto, iOS and Android. In Conjunto an activity counts as done only when every platform it applies to has finished it, so that percentage is not the average of the other two.

The base model never gets client activities; that keeps it neutral. Edits made on the page are stored per client in the browser or the artifact database; to make them permanent, they go into `instance.json` (see [Plan updates](#plan-updates)). After a rebuild, the page adopts the new `plan` and `start_date` from `instance.json` and keeps only what was edited on the page since the previous build. While a browser holds changes that are not in `instance.json`, the plan and the roadmap show a notice with two buttons: download the updated `instance.json`, or discard them.

### Plan updates

`instance.json` is the only source of a client's plan. The page is where it is edited: mark what is done, postpone with a reason, change durations or the start date. "Descargar instance.json", in the notice, downloads the whole file as it is on disk with this browser's `start_date` and `plan`, and adds an entry to `plan_log`. Replace the file in the client folder and rebuild; the notice goes away. Several downloads on the same day add to that day's entry.

`plan_log` is the history of the plan, oldest first: `[{ "date": "YYYY-MM-DD", "changes": ["<one line per activity>"] }]`. The page writes each line from the difference, for example "5 Crea las cuentas de desarrollador · iOS: aplazada al 21 nov 2026; causa: Bloqueo externo". It records what and when, not who. An entry can also be written by hand for a change made outside the page. The roadmap shows the date of the last entry under its title and the history in its detail section; the CSV records it in its header. `validate.py` checks the dates, their order and that every entry lists its changes.
