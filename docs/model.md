# The model on one page

Publishing an app to the App Store and Google Play is a process of 19 phases and 107 steps. The model describes it without deciding who does it or with which tool: each step carries a generic role, and wherever there are alternative ways to do it, a variant. A concrete client is obtained by assigning roles to real teams and picking options.

Content (names, notes, descriptions) is in Spanish; see `docs/conventions.md#language`.

## Three layers

1. **Base** (`model/`): neutral. Names no companies, countries or regulators.
2. **Regulatory profile** (future, `profiles/`): adds controls and approvers to phase S13 for one sector and country. Reused across clients. Named `PR-<SECTOR>-<COUNTRY>`.
3. **Instance** (`clients/<id>/instance.json`): one real owner per lane, one option per variant, renewal dates and decisions.

## Entities

| Entity | Count | What it is |
| --- | --- | --- |
| Actors A01–A31 | 31 | Generic roles: legal owner, Account Holder, Admin, developer, key custodian, signer, Legal, Security, store reviewers, etc. |
| Lanes L1–L7 | 7 | Roles grouped by area: digital channel (business), IT, technical executor, Security, Compliance/Legal/Risk, legal representation/Finance, external parties. |
| Platforms P01–P24 | 24 | Portals, consoles and APIs with URL and purpose. |
| Credentials C01–C27 | 27 | Certificates, keys, profiles and tokens: who creates them, where they live, validity, what they enable. |
| Artifacts F01–F26 | 26 | What is produced and consumed: CSR, .p12, .mobileprovision, .p8, keystore, IPA, AAB, listing, declarations. |
| Phases S0–S18 | 19 | Group steps. Each has a frequency: once per owner, once per app, every version, cyclic. |
| Steps S0.1–S18.6 | 107 | Each with role, inputs, outputs, dependencies and variants. |
| Variants V1–V14 | 14 | Points with alternative ways: where it is built, how it is signed, who holds keys, how it is uploaded, who runs the technology. |
| Renewals R01–R32 | 25 active | What expires or rotates, with cycle and lead time. |
| Milestones m1–m10 | 10 | Per-version tracking: 27 checks in total, each linked to a step. |

## Stages (for presenting)

The 19 phases group into 8 stages; this is how the swimlane diagram is drawn.

| Stage | Phases | Frequency |
| --- | --- | --- |
| Accounts and agreements | S0–S4 | Once per owner |
| App identity | S5 | Once per app |
| Signing and services | S6–S7 | Once per app, with renewals |
| Build | S8–S9 | Every version |
| Upload and testing | S10–S11 | Every version |
| Listing and approvals | S12–S13 | Every version |
| Review and release | S14–S15 | Every version |
| Operation and renewal | S16–S18 | Continuous |

## Underlying rules

- **Business decides and owns; IT answers for the technology; the executor does the work.** V14 says whether the executor is in-house IT or a third party. In the store accounts, ownership (A03, A04) sits with business and technical administration (A05, A06) with IT.
- **Incompatible role pairs.** Custodian and signer; whoever builds and whoever publishes; whoever develops and whoever approves. They may coincide in an instance, but an alert is raised.
- **Irreversible:** the bundle ID and package name, a self-managed app signing key if lost, and the Play App Signing choice before the first open release.
- **Calendar expiries:** Apple membership, distribution certificate and profiles (1 year), TestFlight builds (90 days), target API (every August), minimum SDK (every spring).

## Out of scope

Private channels (Managed Google Play, Apple Business Manager), alternative stores (AppGallery) and the Apple Developer Enterprise Program are foreseen as V13 options but not modelled. Transferring an app between accounts is covered only by a reference note (V11.b).
