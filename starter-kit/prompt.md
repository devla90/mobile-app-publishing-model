# Prompt: build a process model for a new domain

Copy everything below the line into a new conversation with any AI assistant. Then paste `method.md` as the second message (or attach it) when the assistant asks for it, and answer its questions.

---

You are helping me build a **process model**: a versioned, neutral description of a multi-party process that is later tailored to each real client without copying it. I have already done this once for another domain and want to repeat the method, not the content. Follow the method below exactly. If something is unclear, ask; do not invent details of my domain.

## What we are building

A repository with three layers:

1. **Base model** (`model/*.json`): the process as it is for everyone. It is neutral: it names no client, company, country or regulator.
2. **Regulatory profile** (`profiles/PR-<AXES>.json`, usually `PR-<SECTOR>-<COUNTRY>`): extra controls and approvers that an external framework adds on top of the base, each attached to a base step. Reused across clients that share the framework. Optional if no external rule varies between clients.
3. **Client instance** (`clients/<id>/instance.json`): only what differs for one client: who fills each lane, which option of each variant, known dates, and decisions with rationale. Real instances live in a **separate private repository** and are symlinked in; the base repository only versions `clients/example/`.

A small generator turns the JSON into an interactive page, a swimlane diagram and a per-client "what changes" diff. A validator checks every ID and cross-reference and runs on every pull request.

## Entities (adapt the names to my domain, keep the structure)

Roles, lanes, phases, steps and variants are always needed. The others are kept only if the domain has them, and may be reinterpreted (for example, "credential" can be a certificate, licence, permit or guarantee; "platform" can be an ERP, a portal or a registry). An unused entity is left out, not filled with filler.

| Prefix | Entity | What it is |
| --- | --- | --- |
| A | Role (actor) | A generic role that performs or approves steps ("legal owner", "administrator", "signer"). Never a person or a company. |
| L | Lane | Roles grouped by area (business, IT, executor, security, legal/compliance, finance, external parties). A client puts one real team or vendor in each lane. |
| P | Platform | Portal, console, system or API used in the process, with URL and purpose. |
| C | Credential | Something secret or licensed that grants access or proves identity: who creates it, where it lives, how long it is valid. |
| F | Artifact | Something produced and consumed by steps: a file, form, document, package. |
| S | Phase (S0, S1…) and step (S3.2) | Phases group steps and have a frequency: one enum value per unit the phase repeats over (once per organisation, once per item, every cycle, recurring — named for my domain). Each step has one owner role, inputs, outputs, dependencies and the variants that change it. |
| V | Variant | A decision point where there is more than one valid way to do something. Options are letters (a, b, c). No option is "the default". |
| R | Renewal | Anything that expires or must be repeated: cycle in months, how many days ahead to warn, what happens if it lapses, which step renews it. |
| m / c | Milestone and check | Tracking for business: about 10 milestones, each with a few checks linked to a step. One tracking record per cycle if the process repeats, or per item (one supplier, one product…) if it runs once per item. |

Also: **incompatible role pairs** (two roles that should not be the same team, with the risk and a severity `high`/`medium`), **stages** (phases grouped for presenting, which become the diagram columns) and a short list of **diagram activities** (around 25 boxes, each in one lane and one stage) — the diagram is a summary, not a mirror of every step.

## Rules (non-negotiable)

1. **Stable IDs.** IDs are referenced across files and from external documents. Never renumber. A new element takes the next free ID; a removed one leaves its ID unused.
2. **Neutrality.** The base names no clients, companies, countries or regulators. That belongs in an instance or a regulatory profile.
3. **Variants, not defaults.** Where there are alternative ways, model a variant. If I ask to "replace X with Y" and both are valid, add Y as an option instead.
4. **Dated data.** Every external deadline, limit or cost has an official source URL and a verification date in `docs/validation.md`. An internal policy is cited as `INTERNAL` with document name and version. A figure from a blog or from memory is marked `NO SOURCE`.
5. **Two languages, one boundary.** Repository language (file names, JSON keys, enum values, code, comments, docs, commit messages) is separate from content language (JSON values such as names, notes, descriptions; UI strings). Each data file declares `"lang": "<code>"`. Ask me which language each one is.
6. **Enums in the repository language**, with display labels kept in the data or in an i18n file.
7. **The model is the source.** Generated output (`dist/`) is never edited by hand. After every change: run the validator, then the build.
8. **Real client data never goes into the base repository.** If the base repository is public, say so whenever I give you client information and put it in the private overlay.

## How to work with me

**Phase 1 — Interview. Do not generate files yet.** Ask in small batches (at most 6 questions per message), in this order. Skip anything I have already answered.

0. Before anything else: will the base repository be public, and will I share real client data with you? (This decides where every answer goes.)
1. The process: what it achieves, where it starts and ends, how often it repeats, what is irreversible.
2. Who takes part: roles and the areas they belong to (to build the lanes). Which pairs of roles must not be the same team, and why.
3. Where there is more than one valid way to do something (variants).
4. Systems, credentials and artifacts involved.
5. What expires or must be renewed, and which external rules (deadlines, limits, costs) apply, with their official sources if I have them.
6. Languages (repository and content), and whether I want the page and diagram generator now or later.

After each batch, summarise what you understood in a table and list open questions.

**Phase 2 — Propose before writing.** Give me: the list of phases with frequency; the lanes with their roles; the variants with options; the incompatible pairs; and the stages. Wait for my OK.

**Phase 3 — Generate.** Produce files one at a time, in this order, as complete code blocks with the file path as heading:

1. `CLAUDE.md` (or `AGENTS.md`): guide for any AI working on the repository — a table "task → read / do not read", the rules above, the ID table, commands and repository map.
2. `model/actors.json`, `model/phases.json`, `model/variants.json`, then platforms, credentials, artifacts, `model/steps.json`, renewals, milestones and diagram.
3. `clients/example/instance.json`.
4. `docs/model.md` (one page), `docs/conventions.md`, `docs/decisions.md` (one row per decision, with date and rationale), `docs/validation.md`, `docs/deployment.md` (including the private overlay).
5. `generator/validate.py` (Python 3, standard library only). Then, if I asked for it, `generator/build.py`.
6. `.github/workflows/validate.yml` (runs validate and build on every pull request to `main`) and `.gitignore` that excludes every `clients/*` except `example/`.

Keep `steps.json` short at first (a few steps per phase); we will fill it in later. When a file would be very long, tell me and split it.

**Phase 4 — First client.** When I ask, help me instantiate a client in its private repository: ask which real team fills each lane, which option of each variant applies (mark the ones still open with the assumption and where it will be closed), known renewal dates and the decisions taken so far. Then help me prepare the working documents described in `method.md` (client README, sessions, open points, decisions, regulatory profile).

Start with Phase 1. If I have not pasted `method.md` yet, ask for it first.
