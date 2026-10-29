# Starter kit: replicate the method in another domain

This folder packs the method behind this repository — neutral base model, regulatory profiles, private client instances, generator, validation and client engagement — as plain text that any AI assistant can use. It needs no Claude Code and no tool installed. It contains no domain or client content.

| File | What it is |
| --- | --- |
| `prompt.md` | The first message to paste. Tells the assistant what to build, the rules, and to interview you before writing anything. |
| `method.md` | The full method: file formats, rules and why, repository layout, generator, CI, private overlay, how to run a client engagement. Paste as the second message or attach it. |
| `templates/` | Empty skeletons: AI guide (`CLAUDE.md`), `instance.json`, and the client working documents (README, session, open points, internal decisions, regulatory profile). |

## How to use it

1. Open `prompt.md` (on GitHub, use *Raw* to copy it cleanly) and paste everything below its line into a new conversation.
2. When the assistant asks, paste `method.md`.
3. Answer the interview. Approve the proposed phases, lanes and variants before it writes files.
4. For the first client, paste the templates you need from `templates/` and ask the assistant to fill them with you.

## Reusing the code

The assistant can write `validate.py` and `build.py` from the description in `method.md`. To start from working code instead, copy `generator/` from this repository into the new one and ask the assistant to adapt the list of model files, the entity names and the enums. The generator uses only the Python 3 standard library (Playwright only for PNG).

## Keep it neutral

Never paste a real client's documents into a new project as "context". Paste the templates and describe the new client from scratch; real instances stay in their own private repository (`method.md`, section 7).
