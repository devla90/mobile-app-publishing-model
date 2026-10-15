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

Before pushing the base, confirm nothing leaked:

```bash
git check-ignore -v clients/<id> dist/clients/<id> dist/diff-<id>.md   # all three must match a rule
git status --short                                                    # no line with <id>
```

The CI build (`build.yml`) only sees committed files, so GitHub Pages never publishes a real instance.

## Diagram

`dist/swimlanes.svg` can be edited in PowerPoint, Visio or Figma. `swimlanes.png` is 2x for presentations. Per client, in `dist/clients/<id>/`.

## Other UI languages

`python3 generator/build.py --lang <code>` uses `generator/i18n/<code>.json`. To publish two languages, build twice into different folders (the generator writes to `dist/`; copy or rename between builds).
