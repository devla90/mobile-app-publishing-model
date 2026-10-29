# Design decisions

Why the model is the way it is. One row per decision, newest last.

| # | Date | Decision | Rationale |
| --- | --- | --- | --- |
| 1 | 2026-10-13 | Channels: the core covers public stores; private channels and AppGallery are foreseen as V13 options; Enterprise excluded | Each channel adds its own consoles and credentials; leaving them as a variant lets them be added without redoing the catalogue |
| 2 | 2026-10-13 | iOS extensions as targets T01–T07 with their own App ID and profile | Each extension is a profile to renew; an app with push notifications usually has at least a notification service extension |
| 3 | 2026-10-13 | Generic internal approvals in the base, detailed in a regulatory-profile layer per sector and country | Keeps the base neutral and avoids repeating controls across clients in the same sector |
| 4 | 2026-10-13 | Custodian (A12) and signer (A13) kept separate; may be merged in an instance, with an alert | A small client cannot meet the segregation, but the model must be able to express it |
| 5 | 2026-10-13 | A new publication is modelled; updating an app under another account is a reference-only alternative flow (V11.b) | It is the general case; a transfer drags Team ID and key changes that deserve separate treatment |
| 6 | 2026-10-13 | Every data point with a deadline, limit or cost carries a source and a verification date | Store rules change every year |
| 7 | 2026-10-13 | Seven lanes by area (L1–L7) and V14 for who runs the technology | Business decides and owns, IT answers, the executor may be in-house or a third party; with that the diagram serves every client |
| 8 | 2026-10-14 | Estimated durations per phase and a "ready to publish" checklist in the base | They are the two questions business asks most: when, and what is missing |
| 9 | 2026-10-14 | Tracking by milestones (10) instead of by steps (45) | Ticking 45 steps per version is tedious and duplicates the checklist; steps remain reachable from each check |
| 10 | 2026-10-14 | Correction: Apple allows one certificate per distribution type per team, not "max 3" | The official page says so; the previous figure came from secondary sources |
| 11 | 2026-10-14 | Repository for the base model; Claude artifact for shared operations | Tracking real clients is internal information and must not sit in a public repository; the artifact already solves sharing and roles |
| 12 | 2026-10-14 | Repository in English, model content in Spanish, declared with `lang: "es"`; UI strings extracted to `generator/i18n/` | Open-source conventions for anyone contributing structure or code; the content is reviewed by Spanish-speaking business, security and legal teams and translating it without a domain reviewer would introduce errors and double the maintenance. The `lang` field and the i18n file leave the door open to other languages without touching the model |
| 13 | 2026-10-14 | Enum values in English (`ios`/`android`/`both`, `owner`/`app`/`version`/`cycle`, `high`/`medium`) with labels in the data or i18n file | Code compares against enums; labels are content. Mixing them would force Spanish literals into the code |
| 14 | 2026-10-22 | Financial features declaration (validation row 31) applies to every app published on Play, not only financial ones; noted on S12.7 | The official page moved (answer/13516546 → 13849271) and states that apps without financial features must also complete it |
| 15 | 2026-10-29 | Timeline from step dependencies: a phase waits for the earlier phases its steps depend on; dependencies on a later phase are read as overlap; two scenarios (all minimum, all maximum) instead of one probable date; optional `start_date` per instance | No new data to maintain: the step graph already says what waits for what. Summing every phase overstated the total (26–141 days vs 24–131) because the listing runs in parallel with signing and build. A single "probable" date would hide how wide the range is |
| 16 | 2026-10-29 | The plan moves from phases to the 25 diagram activities, with explicit `duration` and `after` in `diagram.json`; days are editable per client, activities can be marked done, and instances can add their own activities (`extra_activities`). Supersedes how decision 15 computed the timeline | Business plans and talks in diagram activities, not phases; deriving the order from step dependencies hid why an activity waited. A client-specific stage such as a pilot run must fit the plan without entering the neutral base |
| 17 | 2026-10-29 | Each client's generated output goes to `clients/<id>/dist/` instead of `dist/clients/<id>/` and `dist/diff-<id>.md` | With a private overlay linked into `clients/`, the output lands in the private repository next to the instance: one folder holds everything for the client and no manual copy goes stale. The base `.gitignore` shrinks to `clients/*` |

## Decisions still open

- Whether the regulatory profile is modelled as a `profiles/` folder with the same format as a partial instance.
- Whether P07, P09 and P24 are removed from platforms (they are tools, not platforms of the process) and whether V8 and V12 become step notes.
- Contingency plan: what happens if a store rejects for lack of a financial licence, if the account is suspended, or if the Account Holder leaves the company without transferring the role.
- Bilingual model content (`locales/<lang>/`) if a non-Spanish-speaking client appears.
