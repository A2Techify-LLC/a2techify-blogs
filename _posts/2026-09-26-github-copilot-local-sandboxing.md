---
layout: post
title: "Copilot Local Sandboxing Makes Agent Permissions Concrete"
date: 2026-09-26 07:30:00 -0500
categories: [ai, engineering]
tags: [copilot, github, security, agents, devtools]
description: "GitHub Copilot app local sandboxing turns agent permissions into per-project policy, which is the right default shape for developer machines."
image: "/assets/images/posts/github-copilot-local-sandboxing.png"
---

GitHub added local sandboxing to the GitHub Copilot app in public preview. The feature is off by default, but it gives teams a concrete way to limit what a local agent session can touch: filesystem paths, network access, local network access, and credentials.

That is the right direction for coding agents. The interesting part is not that a sandbox exists. It is that the policy sits next to the project and fails closed when the operating system cannot enforce it.

<!--more-->

## What Changed

Local sandboxing now applies to local repository and working tree sessions in the GitHub Copilot app. A project can request additional read/write paths, additional read-only paths, denied folders, outbound internet access, local network access, Git credentials for authenticated HTTPS git operations, and GitHub CLI credentials for GitHub CLI authentication.

GitHub says the effective policy can become more restrictive when enterprise-managed settings apply. It also says the sandboxed shell fails with an error if the operating system cannot enforce the requested policy, instead of quietly running without a sandbox.

The feature does not apply to cloud sandbox sessions or sessions running on a remote host. Copilot app sandbox settings and Copilot CLI sandbox settings are configured separately.

## Why We're Paying Attention

Agent risk is usually described in abstract terms: prompt injection, unintended commands, overbroad credentials, or accidental writes. Local sandboxing turns part of that risk into a reviewable policy.

For a small team, the practical question becomes simpler:

```text
What should this agent session be able to read?
What should it be able to write?
Should it reach the internet?
Should it see local network services?
Should it inherit credentials?
```

Those answers will vary by project. A documentation repo may not need credentials or local network access. An infrastructure repo may need read-only access to generated inventory, but should deny secrets directories. A release automation repo may need authenticated git operations, but only after the team is comfortable with the workflow.

## How It Works

The project settings describe the policy the app requests when a sandboxed session starts. Changes apply to new sessions, or after an existing session restarts. For an active local session, GitHub says `/sandbox on` enables sandboxing without changing the project default.

A useful first policy is intentionally narrow:

```text
Filesystem
  read/write: the repository working tree
  read-only: project docs or generated fixtures, if needed
  denied: ~/.ssh, ~/.config, cloud credential folders, password stores

Network
  outbound internet: off until a task needs package or docs access
  local network: off unless testing a local service is required

Credentials
  Git credentials: off by default
  GitHub CLI credentials: off by default
```

That policy will feel inconvenient in a few workflows. That is useful feedback. Each exception should map to a real task, not to a vague desire for the agent to have everything a human shell has.

## A Small Useful Test

This post does not need a sample repo. The useful work is a permission audit against the repositories where a team already uses agents.

Pick one active repository and write down the expected sandbox before turning it on:

```text
Repo: internal-docs
Allowed writes: repo only
Allowed reads: repo only
Denied reads: ~/.ssh, ~/.config, ~/Downloads, cloud config folders
Internet: off for editing, on only for dependency/doc research sessions
Local network: off
Git credentials: off until a human reviews the diff
GitHub CLI credentials: off
```

Then run three ordinary tasks: a documentation edit, a test run, and a dependency lookup. If a task fails, decide whether the failure reveals a real required permission or a workflow that should stay outside agent automation.

## Cost And Operational Notes

The feature itself is not a substitute for source control review, branch protection, secret scanning, or least-privilege credentials. It reduces blast radius on a developer machine. It does not prove that an agent made a correct change.

The biggest operational detail is defaults. Local sandboxing is off by default, so teams that want this behavior need an adoption path. Start with repositories where the agent's job is narrow and the cost of denied access is low: docs, tests, small refactors, and local-only build tasks.

For enterprise teams, pair sandbox policy with managed settings and telemetry. GitHub also announced OpenTelemetry support for the Copilot app through enterprise-managed settings, with prompt and response content excluded by default. Together, sandboxing and telemetry give admins two different controls: limit what the agent can do, and observe how agent sessions use models and tools.

The privacy line still matters. Do not enable prompt or response content capture casually. Treat agent telemetry like production logs: useful for debugging, risky when it quietly grows into a copy of sensitive work.

## What We'd Watch Next

The preview is interesting because it makes local agent governance less hand-wavy. The next questions are whether sandbox policies become portable across tools, whether teams can version them with repositories, and how clearly developer tools explain why a command was denied.

For now, the practical takeaway is straightforward: if a coding agent runs on a developer machine, it should not automatically inherit the whole machine. Project-level sandboxing is a cleaner default than trust-by-shell.

## References

- [GitHub Changelog: Local sandboxing in the GitHub Copilot app](https://github.blog/changelog/2026-09-23-local-sandboxing-in-the-github-copilot-app/)
- [GitHub Changelog: OpenTelemetry in the GitHub Copilot app](https://github.blog/changelog/2026-09-22-opentelemetry-in-the-github-copilot-app/)
- [GitHub Docs: OpenTelemetry for agent monitoring](https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/opentelemetry)
- [GitHub Docs: Get started with enterprise managed settings for Copilot](https://docs.github.com/copilot/how-tos/administer-copilot/manage-for-enterprise/use-managed-settings/get-started)
