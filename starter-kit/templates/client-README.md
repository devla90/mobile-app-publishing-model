# <Client> — instance of the base model

Instance of <what is being delivered> for <client>. Reference date: <YYYY-MM-DD>. Contains internal information: **private repository only**.

| File | What it is | When it is updated |
| --- | --- | --- |
| `instance.json` | Lanes, confirmed variants, open variants and decisions. Read by `generator/build.py`. | When a variant closes or a decision is taken |
| `open-points.md` | The assumptions about <other party>'s work (O1–On), with status. | After each session with <other party> |
| `session-1.md` | First session: questions by block, agenda, opening script. | Before and after the session |
| `internal-decisions.md` | Decisions that do not depend on <other party>, with owner. | When resolved |
| `regulatory-profile.md` | Profile PR-<SECTOR>-<COUNTRY>: controls on the approvals phase. | When the profile layer is defined |

## Operating model in brief

<One paragraph: who owns, who executes, who decides go-live, which variant of "who runs the technology" applies.>

| Lane | Owner | Roles | What they do |
| --- | --- | --- | --- |
| L1 <name> | <real team> | A.., A.. | <…> |
| L2 <name> | <real team> | A.., A.. | <…> |
| L3 <name> | <real team or vendor> | A.., A.. | <…> |

**Role pairs that need attention**

- <Role X> (A..) and <role Y> (A..). <How they fall in this client and the decision taken.>

## What changes from the base model

| # | Base step | For <client> | Effect |
| --- | --- | --- | --- |
| 1 | S.. <name> | <what is different> | <consequence> |

## How to use this folder

1. Clone this repository next to the base and link the folder from the base: `ln -s ../../<client>-private/clients/<id> clients/<id>`.
2. `python3 generator/validate.py && python3 generator/build.py --no-png` generates `dist/clients/<id>/` and `dist/diff-<id>.md`.
3. Commit changes here, never in the base.
