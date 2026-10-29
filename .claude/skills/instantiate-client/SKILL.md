---
name: instantiate-client
description: Create or update clients/<id>/instance.json for a new client (lanes, variants, renewal dates, decisions) and generate its page, diagram and diff. Use when asked to instantiate, adapt or tailor the model to a specific company.
---

# Instantiate a client

An instance is what differs from the base model for one client. The model is not copied; only the difference is written. Content values (lane names, decisions) are written in Spanish, like the rest of the model content.

## What to read

- `clients/example/instance.json` (the template, ~40 lines).
- `model/actors.json`, only the `lanes` key (L1–L7, name and what each covers) and `incompatible_pairs`.
- `model/variants.json` (V1–V14 with their options).
- `model/renewals.json` only if the client already has accounts open and dates are known.

Do not read `model/steps.json`.

## Procedure

1. **Identifier.** Lowercase, no spaces or accents (`bank-x`, `retail-y`). Folder `clients/<id>/`.
2. **Lanes.** Ask for each L1–L7 which real area or company occupies it. If the user does not know one, leave the model's generic name. Rules:
   - L1 (business) and L2 (IT) must be areas of the entity itself; if the user puts a vendor in L1, flag it: Apple requires financial apps to be published by the entity.
   - L3 (technical executor) is where a vendor goes, if any; that implies `"V14": "b"`.
3. **Variants.** Ask only about the ones that affect the client. The ones that vary most between clients: V1 (account type), V2 (account ownership), V3 (where it is built), V7 (how it is uploaded), V13 (channel), V14 (who runs the technology). The rest are inherited if not stated. Write the option key (letter).
4. **Incompatible pairs.** If both roles of a pair end up in lanes with the same name (e.g. custodian and signer both "Proveedor X"), add it as a decision with the rationale and warn that the page will show the alert.
5. **Renewals and start date.** Only known dates, ISO format, key = renewal ID. If the client has a planned start, set `start_date` (ISO): the page then shows when each phase ends and the estimated first publication.
6. **Decisions.** Each agreement with `date`, `decision`, `owner` and `rationale`. This is the record consulted later.
7. **Regulatory profile.** `PR-<SECTOR>-<COUNTRY>` in uppercase (`PR-RETAIL-XX`). If the `profiles/` folder does not exist, only the name is stored.
8. Write the file, then run `python3 generator/validate.py && python3 generator/build.py --no-png`.
9. Deliver: paths of `dist/clients/<id>/index.html`, `swimlanes.svg`, `swimlanes-<id>.drawio` and `dist/diff-<id>.md`. Summarise the diff in three lines: lanes assigned, variants chosen, alerts.

## What is not done

- `model/` is never modified from an instantiation. If the client needs a step that does not exist, that is `edit-model` work.
- No personal names; areas or companies only.
- No instance with internal data is pushed to a public repository. Warn if the repository is public.
- For a real client, create the instance in its private overlay repository and symlink it into `clients/`; `.gitignore` keeps it and its `dist/` output out of the base. See `docs/deployment.md#private-client-instances`.
