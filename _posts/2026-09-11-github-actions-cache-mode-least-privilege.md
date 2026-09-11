---
layout: post
title: "GitHub Actions Cache Mode Makes CI Caches Less Trusting"
date: 2026-09-11 07:30:00 -0500
categories: [security, ci]
tags: [github, security, ci]
description: "GitHub Actions cache-mode is now generally available, giving workflows and jobs explicit read, write, write-only, or no-cache access so teams can reduce cache-poisoning risk."
image: "/assets/images/posts/github-actions-cache-mode-least-privilege.png"
---

GitHub made `cache-mode` generally available for GitHub Actions. The practical change is simple: a workflow or job can now say exactly how much cache access it should have instead of accepting a broad restore-and-save path by default.

That matters because CI caches are part of the software supply chain. They are convenient, fast, and easy to forget. If an untrusted workflow can write a cache that a more privileged workflow later restores and executes from, the cache becomes a persistence path, not just a performance optimization.

<!--more-->

## What Changed

`cache-mode` is a new GitHub Actions workflow syntax key for controlling cache access at the workflow level, the job level, or both. Job-level settings override workflow-level settings.

GitHub exposes four modes:

- `read` restores caches but does not save new ones.
- `write` restores and saves caches.
- `write-only` saves caches but does not restore them.
- `none` disables both restore and save.

If a workflow does not declare `cache-mode`, GitHub still applies trigger-based defaults. Trusted triggers such as `push`, `workflow_dispatch`, `repository_dispatch`, `delete`, `registry_package`, `page_build`, and `schedule` can write caches. Low-trust triggers that resolve to the default branch, including `pull_request_target`, `issue_comment`, and `workflow_run`, get read-only default cache access.

The new part is that teams can make this policy explicit and narrower. GitHub says the setting is enforced with scoped cache tokens, honored by `actions/cache` and the `@actions/cache` toolkit, and carried through reusable workflows so a called workflow cannot exceed the explicit cache access granted by its caller.

## Why We're Paying Attention

Most teams already know to be careful with secrets in Actions. Caches get less attention because they look like build acceleration, not authority. But dependency caches, compiler caches, package manager directories, and generated build outputs can all affect later execution.

The risk is sharper around workflows that run with elevated context while reacting to lower-trust inputs. A `pull_request_target` workflow, for example, runs in the context of the base repository. GitHub's secure default keeps those runs from writing to the default branch cache scope, but that safety is easier to reason about when the YAML says what the job is allowed to do.

The useful habit is to treat cache access like token permissions. Start from the job's real need, then grant the smallest cache mode that supports it.

## How It Works

At the top level, `cache-mode` applies to every job in the workflow:

```yaml
name: pull-request-checks
on: pull_request_target

cache-mode: read

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/cache@v4
        with:
          path: ~/.npm
          key: npm-<package-lock-hash>
      - run: npm ci
      - run: npm test
```

With `read`, the job can restore an existing trusted cache, but a save is skipped. GitHub says skipped cache operations log an informational message and the workflow continues: a skipped restore behaves like a cache miss, and a skipped save is simply not performed.

For mixed workflows, job-level policy is more precise:

```yaml
name: ci
on:
  push:
  pull_request:

cache-mode: read

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - run: npm ci
      - run: npm run lint

  refresh-cache:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    cache-mode: write
    steps:
      - uses: actions/checkout@v6
      - uses: actions/cache@v4
        with:
          path: ~/.npm
          key: npm-<package-lock-hash>
      - run: npm ci
```

That pattern keeps most jobs restore-only while letting a trusted main-branch job maintain the cache.

## A Small Useful Test

This post does not need a sample repo. The most useful example is a short audit you can run against existing workflow files.

Start by classifying every workflow that uses `actions/cache`, a setup action with built-in caching, or a package manager cache:

```text
Actions cache review

Workflow: .github/workflows/ci.yml
Triggers: push, pull_request, pull_request_target, workflow_run, schedule, manual
Cache paths: ~/.npm, ~/.cache/pip, target/, build/, vendor/, toolchains
Cache readers: jobs that restore or rely on generated files
Cache writers: jobs that save or refresh caches
Untrusted input before write: yes/no
Secrets or elevated permissions in later readers: yes/no
Recommended cache-mode: read, write, write-only, or none
```

Then make the default explicit. For workflows touched by untrusted actors, prefer this until there is a strong reason to do otherwise:

```yaml
cache-mode: read
```

For reusable workflows, set the cache mode on the calling job when you want a hard cap:

```yaml
jobs:
  call-shared-checks:
    uses: org/automation/.github/workflows/shared-checks.yml@main
    cache-mode: read
```

GitHub's docs call out an important edge case: if the caller does not set or inherit an explicit `cache-mode`, a called reusable workflow can explicitly request `write` even when the caller's low-trust trigger would otherwise default to `read`. If the caller explicitly caps access at `read`, a called workflow that asks for more will fail validation instead of silently getting broader cache authority.

## Cost And Operational Notes

`cache-mode` is generally available on github.com for all GitHub plans. It is not a new paid security product. The cost is the cleanup work: someone has to inventory workflows, decide which jobs actually need cache writes, and remove cache writes from jobs that only need speed.

There are a few operational details worth knowing before a broad rollout:

- Do not put credentials, tokens, or other sensitive files in cache paths. GitHub's dependency caching docs warn that anyone with read access can extract cache contents.
- Treat cache contents as unsigned input. Restoring a cache into a job that later executes files from that cache deserves the same skepticism as restoring any other build artifact.
- `write-only` is useful for cache warming jobs that should not consume previous cache state.
- `none` is a good fit for release, signing, deployment, and secret-heavy jobs where a cache saves a little time but adds a lot of ambiguity.
- Explicitly declaring `write` or `write-only` on low-trust triggers overrides GitHub's secure read-only default and can reintroduce cache-poisoning risk.

The best migration path is usually boring: set workflow-level `read`, add job-level `write` only to trusted cache maintenance jobs, and leave release jobs at `none` unless there is a measurable need.

## What We'd Watch Next

The next thing to watch is how setup actions expose and document cache behavior. Many teams do not call `actions/cache` directly; they enable cache options inside language setup actions. The security model only works if developers can quickly see which jobs restore, save, or skip cache access.

We would also watch whether repository and organization policy controls grow around this. `cache-mode` is a useful YAML primitive. Larger teams will eventually want reporting: which workflows can write caches, which low-trust triggers override the default, and which reusable workflows request broader cache access than callers expect.

The short version: CI caches should be fast, but they should not be trusted by accident. `cache-mode` gives teams a small, practical knob for making that boundary visible.

## References

- [GitHub Changelog: Control GitHub Actions cache access with cache-mode](https://github.blog/changelog/2026-09-10-control-github-actions-cache-access-with-cache-mode/)
- [GitHub Docs: Workflow syntax for GitHub Actions, cache-mode](https://docs.github.com/actions/reference/workflows-and-actions/workflow-syntax#cache-mode)
- [GitHub Docs: Dependency caching reference, controlling cache access with cache-mode](https://docs.github.com/actions/reference/workflows-and-actions/dependency-caching#controlling-cache-access-with-cache-mode)
- [GitHub Docs: Dependency caching reference, cache access for low-trust workflow triggers](https://docs.github.com/actions/reference/workflows-and-actions/dependency-caching#cache-access-for-low-trust-workflow-triggers)
