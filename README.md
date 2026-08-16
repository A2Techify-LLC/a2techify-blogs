# A2Techify Field Notes

This repository contains the Jekyll site published at [blogs.a2techify.com](https://blogs.a2techify.com). It is where the A2Techify engineering team publishes practical notes on AI, developer tooling, and production systems.

## Run it locally

You need a current Ruby version, Bundler, and Node.js 20 or newer.

```bash
bundle install
bundle exec jekyll serve
```

The local site is available at `http://127.0.0.1:4000`.

## Publish an article

1. Add `_posts/YYYY-MM-DD-slug.md` using the structure in `admin/daily-publishing-playbook.md`.
2. Add a 1200×630 article image under `assets/images/posts/`.
3. Add a page under `tags/<tag>/index.html` for every new tag.
4. Run the local checks and generate the LinkedIn draft.

```bash
node tools/validate-site.mjs
node tools/create-linkedin-drafts.mjs _posts/YYYY-MM-DD-slug.md
bundle exec jekyll build
```

The blog remains the canonical version. LinkedIn drafts are generated into `linkedin-drafts/` as a starting point. Copy a draft into LinkedIn before editing it there; regenerating drafts can overwrite the repository copy.

## Repository map

- `_posts/` — published articles
- `_layouts/` and `_includes/` — site templates
- `assets/` — styling and article artwork
- `tags/` — topic landing pages
- `tools/` — content validation and LinkedIn draft generation
- `admin/` — the editorial playbook

GitHub Pages deploys `main`. Pull requests and pushes run content validation and a full Jekyll build.
