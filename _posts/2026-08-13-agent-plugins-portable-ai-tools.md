---
layout: post
title: "What Agent Plugins 1.0 Gets Right About Portable Tooling"
date: 2026-08-13 07:30:00 -0500
categories: [ai, devtools]
tags: [agent-plugins, copilot, vscode, mcp, skills, devtools]
sample_repo: "https://github.com/A2Techify-LLC/agent-plugin-portable-starter"
description: "A closer look at the portable packaging layer for skills, commands, hooks, and MCP configuration."
image: "/assets/images/posts/agent-plugins-portable-ai-tools.png"
modified: 2026-08-16 07:12:00 -0500
---

GitHub's Agent Plugins 1.0 release gives AI tooling a packaging layer that feels closer to normal software distribution. It is now generally available in VS Code, Copilot CLI, the GitHub Copilot SDK, and the Copilot app, which means plugin authors can ship one portable core instead of maintaining separate layouts for every client.

The standard is small on purpose: a root `plugin.json`, Agent Skills under `skills/`, and optional MCP server configuration in `mcp.json`. That is enough to make a plugin understandable to more than one agent without forcing every client to support the same hooks, UI, commands, or marketplace metadata.

<!--more-->

## What changed

GitHub's August 12 changelog says Agent Plugins 1.0 support is generally available in VS Code, Copilot CLI, the GitHub Copilot SDK, and the GitHub Copilot app across Copilot plans. The same post says Agent Plugins 1.0 was published on August 6 with AWS, Anysphere, Microsoft, OpenAI, and Vercel, and that Google joined as a core maintainer the same day.

The open specification defines a self-contained plugin directory. Every plugin has a root `plugin.json`; skills and MCP configuration are optional. Compatible clients can discover the portable pieces they support from that same package.

For teams that already build internal agent tooling, this is the difference between "we wrote a useful skill" and "we wrote a useful skill that only works in one client because the packaging is different everywhere."

## Why we're paying attention

Agent tooling is starting to look like normal software infrastructure. Teams want reusable runbooks, repo inspection workflows, deployment helpers, security review steps, database tools, incident triage tools, and documentation search. Those capabilities should not be trapped inside one assistant's private format.

Portability matters for three practical reasons:

- Teams can share the same skill instructions across compatible clients.
- MCP server configuration has a standard home instead of being hidden in client-specific manifests.
- Client-specific behavior can still exist, but it is namespaced so it does not pollute the portable core.

That last point is important. Agent Plugins 1.0 does not pretend every client has the same feature set. Hooks, commands, UI, and marketplace behavior may still be client-specific. The standard gives the shared pieces a stable place and gives the non-shared pieces a boundary.

## How it works

The minimum package is just:

```text
hello-plugin/
├── plugin.json
└── skills/
    └── greet/
        └── SKILL.md
```

The manifest declares the Agent Plugins schema and the plugin name:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "hello-plugin"
}
```

The manifest schema is closed. The official manifest documentation lists the portable top-level fields as `$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, and `extensions`. Client-specific data belongs under `extensions`, keyed by a reverse-domain namespace.

Skills live under immediate child directories of `skills/`. A client does not recursively search arbitrary nested folders for more skills; it discovers each `skills/<name>/SKILL.md`.

MCP servers, when present, live in root `mcp.json`. The MCP documentation says the top-level fields are `$schema` and `mcpServers`, with server entries declaring transports such as `stdio`, `streamable-http`, or legacy `sse`. Remote MCP headers are visible package data and must not contain credentials or secrets.

## A small test

We put together a small public starter to see how much of the format is genuinely portable:

[A2Techify-LLC/agent-plugin-portable-starter](https://github.com/A2Techify-LLC/agent-plugin-portable-starter)

It includes:

- a valid `plugin.json`,
- one portable skill at `skills/repo-context-pack/SKILL.md`,
- a checklist reference file,
- a tiny Python validator,
- a smoke test file for environments with `pytest`.

The included skill helps an agent build a concise repository context pack before it starts coding. That is a realistic internal plugin pattern: not a huge demo, just one repeatable workflow that can save time and reduce careless edits.

Run the local validator:

```bash
git clone https://github.com/A2Techify-LLC/agent-plugin-portable-starter.git
cd agent-plugin-portable-starter
python scripts/validate_plugin.py
```

Expected output:

```text
plugin validation passed
```

The validator checks the starter's portable structure and catches common mistakes, such as unsupported manifest fields, a missing schema, or a skill directory without `SKILL.md`. It is intentionally not a full Agent Plugins client.

## What the repo covers

The sample repo is designed to be copied:

1. Rename the package and update `plugin.json`.
2. Replace the `repo-context-pack` skill with your own workflow.
3. Keep each skill under `skills/<skill-name>/SKILL.md`.
4. Add `mcp.json` only when there is an actual MCP server to expose.
5. Put client-specific hooks, commands, UI, or marketplace files under a documented reverse-domain extension namespace.
6. Re-run `python scripts/validate_plugin.py`.

The repo avoids paid APIs, hosted model calls, secrets, and account-specific infrastructure. It is just files plus a standard-library smoke test.

## Before you ship it

Agent Plugins 1.0 is a packaging standard, not a billing model. The starter repo costs nothing to run locally. Real plugins can still introduce operational costs depending on what they connect to.

For internal teams, the guardrails are straightforward:

- Do not package secrets in `plugin.json`, `mcp.json`, headers, examples, or reference files.
- Treat remote MCP headers as public package data unless the client explicitly manages credentials elsewhere.
- Keep plugin-provided paths inside the plugin root.
- Version skills like production artifacts because agents will rely on their instructions.
- Test each supported client separately, especially for extension behavior outside the portable core.

The biggest operational mistake is assuming portability means identical behavior everywhere. The portable core should load consistently, but client-specific features still need client-specific testing.

## What we'd watch next

The next useful step is better validation and release tooling. Teams will want CI checks that validate `plugin.json`, `mcp.json`, skill front matter, path containment, examples, and client extension packages before publishing.

Expect more agent clients to support the same package shape, and expect organizations to care about policy: approved plugin marketplaces, MCP allowlists, and clear review for tools that can touch source code, deployments, databases, or customer data.

For builders, the practical move is simple: take one internal workflow that already works, package it as a small skill, validate it, and keep client-specific behavior out of the portable manifest.

## References

- [GitHub Changelog: Agent Plugins 1.0 in VS Code, Copilot CLI, and the Copilot app](https://github.blog/changelog/2026-08-12-agent-plugins-1-0-in-vs-code-copilot-cli-and-the-copilot-app)
- [Agent Plugins: Build an Agent Plugin](https://agent-plugins.org/plugin-authors)
- [Agent Plugins specification v1.0.0](https://github.com/agentplugins/agent-plugins-spec/blob/main/spec/1.0.0.md)
- [Agent Plugins manifest documentation](https://agent-plugins.org/plugin-authors/manifest)
- [Agent Plugins skills documentation](https://agent-plugins.org/plugin-authors/skills)
- [Agent Plugins MCP server documentation](https://agent-plugins.org/plugin-authors/mcp-servers)
- [Agent Plugins example repo](https://github.com/agentplugins/agent-plugins-example)
- [VS Code documentation: Agent plugins in VS Code](https://code.visualstudio.com/docs/agent-customization/agent-plugins)
- [A2Techify sample repo: Agent Plugin Portable Starter](https://github.com/A2Techify-LLC/agent-plugin-portable-starter)
