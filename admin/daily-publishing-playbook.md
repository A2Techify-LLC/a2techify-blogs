# Daily A2Techify Technology Post Playbook

This is the operating checklist for the daily blog job.

## Selection

Pick one technology item that is genuinely useful to builders. Prefer:

- Official release posts, model cards, documentation, standards, or primary repositories.
- Open-source, local-first, or free-tier-safe tools when they are credible.
- Topics with a runnable sample repo: AI models, LoRA/QLoRA, quantization, agents, RAG, browsers, databases, devtools, observability, security, or infrastructure.

Avoid pure rumor, SEO summaries, pricing pages without technical substance, and tools that require paid services for the sample.

## Research

Use web search and fetch primary sources. Capture:

- What was released or changed.
- Who released it.
- What problem it solves.
- What hardware, cost, or operational limits matter.
- What a developer can build in one small repo.

## Blog Format

Create `_posts/YYYY-MM-DD-slug.md`.

Front matter:

```yaml
---
layout: post
title: "Clear Practical Title"
date: YYYY-MM-DD 07:30:00 -0500
categories: [ai, engineering]
tags: [tag-one, tag-two]
sample_repo: "https://github.com/A2Techify-LLC/example-repo"
---
```

Post structure:

- What happened
- Why it matters
- How the technology works
- Practical example
- Sample repo
- Cost and operational notes
- What to watch next
- References

## Sample Repo

Create a small repo under `A2Techify-LLC` when a runnable example is useful. Keep it:

- Public unless it contains private infrastructure or secrets.
- Free to run locally.
- Small enough to understand quickly.
- Validated with at least one local smoke test.

## Publishing

Commit and push the blog repo.

Generate LinkedIn drafts after posts change:

```bash
node tools/create-linkedin-drafts.mjs
```

The generator writes each draft to:

```text
linkedin-drafts/YYYY-MM-DD-post-slug.md
```

Use that draft as the starting point for the A2Techify LinkedIn newsletter edition. Publish manually from the A2Techify LinkedIn Page, then add the published URL to the source post front matter:

```yaml
linkedin_url: "https://www.linkedin.com/pulse/..."
```

Keep the blog post as the canonical source and use LinkedIn as the shorter newsletter edition.

If the post creates or references A2Techify infrastructure, update the A2Techify Labs dashboard only when the operational state changes.
