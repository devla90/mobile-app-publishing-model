# Deployment

## Static site (this repository)

`dist/` is a static site. Options:

- **GitHub Pages.** Settings → Pages → Source: GitHub Actions. `.github/workflows/build.yml` builds `dist/` and publishes it on every push to `main`. On the free plan, Pages only works for public repositories.
- **Netlify or Cloudflare Pages.** Publish from a private repository and allow password protection. Build command: `python3 generator/build.py --no-png`. Publish directory: `dist`.
- **Local.** Open `dist/index.html` in a browser.

The static page keeps clients, versions and dates only in the browser of whoever opens it (`localStorage`, keys prefixed `mapm-`). There is no shared state and no roles.

## Claude artifact (shared operations)

For the team to tick milestones and see the same state, the same page is published as a Claude artifact with the `db` and `user` capabilities. There:

- Clients and versions are stored in the artifact database, shared among those with access.
- Roles are the artifact's: Viewer reads; Contributor and above tick milestones and edit the instance.
- Claude can read or update the tracking from a conversation.

To regenerate the artifact after changing the model:

1. `python3 generator/build.py --no-png`.
2. Take `dist/index.html`. Remove `<!doctype>`, `<html>`, `<head>` and `<body>` wrappers (the artifact adds them) and the line `window.claude={use:async()=>null};`.
3. Publish with `capabilities: {db: {}, user: {}}`. `generator/templates/page_logic.js` already contains the `db` logic with local fallback.

## Branch protection

`main` only changes through pull requests. A ruleset on `main` requires one approval and the `validate` check (`.github/workflows/validate.yml`, which runs `validate.py` and `build.py --no-png`), and blocks force pushes and deletion. Tags `v*` are protected from being moved or deleted. Releases are tagged on `main` with semantic versions (`v1.0.0`).

On the free plan, rulesets only work on public repositories.

## Private client instances

Real instances hold internal information and never go into this repository. Only `clients/example/` and its output are versioned; `.gitignore` excludes every other `clients/<id>/`, `dist/clients/<id>/` and `dist/diff-<id>.md`.

Keep each real client in its own private repository (an overlay), next to the base:

```
app-stores/
  mobile-app-publishing-model/   this repository (public or shareable)
  <client>-private/              private repository
    clients/<id>/instance.json   plus the client's working documents
```

Link it into the base and build:

```bash
ln -s ../../<client>-private/clients/<id> clients/<id>
python3 generator/validate.py && python3 generator/build.py --no-png
```

Edits made through the link land in the private repository; commit them there. The output goes to `dist/clients/<id>/` and `dist/diff-<id>.md`, which are ignored. Copy them into the private repository if they must be shared.

`generator/validate.py` fails if any file under `clients/`, `dist/clients/` or `dist/diff-*.md` other than `example` is in the git index, so a forced `git add -f` is caught before the commit and in CI. Before pushing to a public remote, `git status --ignored` should list each real instance as ignored (`!!`).

Before pushing the base, confirm nothing leaked:

```bash
git check-ignore -v clients/<id> dist/clients/<id> dist/diff-<id>.md   # all three must match a rule
git status --short                                                    # no line with <id>
```

The CI build (`build.yml`) only sees committed files, so GitHub Pages never publishes a real instance.

## Diagram

`dist/swimlanes.svg` can be edited in PowerPoint, Visio or Figma. `swimlanes.png` is 2x for presentations. Per client, in `dist/clients/<id>/`.

`dist/swimlanes.drawio` is the same diagram for draw.io (desktop or app.diagrams.net). Lanes are containers, activities keep their number, lane, stage and phases as data (*Edit Data*), and arrows are connected to the activities, so they follow when a box is moved. It is generated with the SVG from the same layout, so both always match. Per client it is named `dist/clients/<id>/swimlanes-<id>.drawio`, so several clients can be opened in draw.io without mixing them up.

The `.drawio` is output, not source: every build overwrites it. Change the diagram in `model/diagram.json`; edit the `.drawio` by hand only in a copy outside `dist/`.

## Other UI languages

`python3 generator/build.py --lang <code>` uses `generator/i18n/<code>.json`. To publish two languages, build twice into different folders (the generator writes to `dist/`; copy or rename between builds).
