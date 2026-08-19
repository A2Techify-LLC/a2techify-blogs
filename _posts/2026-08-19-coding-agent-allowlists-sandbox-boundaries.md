---
layout: post
title: "Coding Agent Allowlists Are Not A Security Boundary"
date: 2026-08-19 07:30:00 -0500
categories: [ai, security]
tags: [agents, security, docker, devtools]
description: "A practical look at why trusted-command allowlists can fail for coding agents, and what teams should move into the sandbox boundary instead."
image: "/assets/images/a2techify-blogs-card.png"
---

Docker published a useful security walkthrough this week on a Cursor vulnerability that turned approved developer commands into execution triggers. The short version: an agent could quietly change shell environment variables, then a developer-approved command like `git branch` could run something else because the surrounding environment had already been poisoned.

The important lesson is bigger than one editor bug. Coding agent security cannot stop at "ask before running scary commands." Once an agent reads untrusted repository text, issue comments, docs, dependency output, or generated files, the setup step and the trigger step can be split apart.

<!--more-->

## What Changed

Docker's post walks through CVE-2026-22708, a Cursor issue disclosed by Pillar Security and fixed by Cursor in version 2.3. Cursor's advisory says that when the agent ran in non-default Auto-Run Mode with Allowlist mode enabled, some shell built-ins could execute without appearing in the allowlist and without asking for user approval.

That mattered because built-ins such as `export`, `typeset`, and `declare` can change the shell environment. Once the environment is changed, ordinary tools may behave differently when they start.

The simplest version looks like this:

```sh
# Setup: the agent changes the environment.
export PAGER="open -a Calculator"

# Trigger: the user approves an ordinary command.
git branch
```

`git branch` is not suspicious. It is exactly the kind of command developers allow because approving it all day is annoying. But Git uses `PAGER` to display output, so the command name was not the whole action.

## Why We're Paying Attention

Small teams are adopting coding agents faster than they are updating their local threat models. The common control is still a per-machine list of commands the agent can run automatically.

That is useful for workflow friction. It is weak as a security boundary.

The issue is context. A command allowlist checks the command in front of it, not every prior state change that can affect what that command does. Environment variables are only one example. Shell profiles, Git hooks, Makefile targets, package scripts, tool config files, editor tasks, and local MCP servers can all become places where "safe" commands inherit unsafe behavior.

This is the same practical problem operators already know from CI: approving `npm test` does not mean much if `package.json`, the lockfile, and the environment are attacker-controlled.

## How The Attack Shape Works

There are two phases:

1. The agent reads attacker-controlled text and performs a quiet setup step.
2. The user or allowlist approves a normal command that inherits the changed context.

The approval prompt can be truthful and still incomplete. It can show `git branch`, `python3 script.py`, or another familiar command while missing the fact that startup behavior was changed earlier.

Cursor improved command parsing around the reported edge cases. That is good remediation for the specific product issue. It does not remove the broader class of risk from agentic development, because coding agents are expected to read and manipulate code-like text all day.

## A Small Useful Test

This post does not need a sample repo. The useful test is an inventory of what your agents can change before an approved command runs.

For each coding agent setup, write down the current boundary:

```text
agent:
  mode: auto-run, ask-first, or manual
  command_policy: allowlist, denylist, ask-all, or sandboxed shell
  workspace_access: live host checkout or private clone
  network_access: default allow, deny-by-default, or task-specific
  credential_access: raw secrets, forwarded agent, injected headers, or none
  persistent_state:
    - shell profiles
    - git hooks
    - package scripts
    - editor tasks
    - agent skills
    - local MCP servers
```

Then review three ordinary commands your team already trusts:

```text
git branch
python3 script.py
npm test
```

For each one, ask what files, environment variables, hooks, package scripts, credentials, and network paths can affect the real behavior. If the answer is "a lot of things on the host," the allowlist is mostly a convenience feature.

## What To Move Into The Boundary

Docker's answer is Docker Sandboxes: run coding agents inside isolated microVMs with their own kernel, filesystem, Docker daemon, and governed network path. The docs describe the primary trust boundary as the microVM. The agent can have broad power inside that VM, including package installs and sudo, while host filesystem access, host Docker, and direct host networking stay outside the boundary unless explicitly shared.

That changes the consequence of the same attack:

- The prompt injection can still land.
- The environment can still be poisoned inside the sandbox.
- The approved command can still do the wrong thing inside the sandbox.
- Host files, host credentials, and undeclared network destinations are much harder to reach.

That last line is the point. Isolation does not make the agent wise. It limits what a bad action can touch.

Docker's security docs also call out the parts that are not isolated by default. A directly mounted workspace is still live on the host, so Git hooks, build scripts, and project config deserve review. Shared agent skills can carry changes from one sandbox to another unless that sharing is disabled. Local stdio MCP servers run on the host, not inside the sandbox VM.

Those caveats are not reasons to skip sandboxing. They are the checklist for using it honestly.

## Cost And Operational Notes

The `sbx` CLI is documented as free to use, including commercial work. Docker says organization governance is the separate paid subscription area, which matters if you need central policy across many developer machines.

For a small team, the low-friction path is:

- reduce or remove broad auto-run allowlists for unsandboxed agents;
- run untrusted repository work in an isolated environment;
- prefer clone-style workspace isolation when reviewing unfamiliar code;
- deny network by default and add task-specific egress rules;
- keep raw credentials out of the agent environment;
- review Git hooks, package scripts, shell profiles, editor tasks, and local MCP servers as executable surfaces;
- log what the agent ran and what files changed.

None of this requires a paid API. The cost is operational discipline: a little more setup, clearer per-task boundaries, and fewer invisible assumptions on each laptop.

## What We'd Watch Next

The next useful maturity step is policy portability. Per-developer allowlists drift quickly. A reviewed sandbox kit, project-level agent policy, or centrally managed network/filesystem rule has a better chance of being audited and reused.

The builder takeaway is direct: treat command allowlists as ergonomics, not containment. If a coding agent is allowed to read untrusted text and run tools, the real security boundary should be the filesystem, credential path, and network path around the agent.

## References

- [Docker Blog: Coding Agent Horror Stories: The Command You Already Approved](https://www.docker.com/blog/coding-agent-horror-stories-the-command-you-already-approved/)
- [Cursor Security Advisory: Terminal Tool Allowlist Bypass via Environment Variables](https://github.com/cursor/cursor/security/advisories/GHSA-82wg-qcm4-fp2w)
- [Pillar Security: The Agent Security Paradox](https://www.pillar.security/blog/the-agent-security-paradox-when-trusted-commands-in-cursor-become-attack-vectors)
- [Docker Docs: Docker Sandboxes](https://docs.docker.com/ai/sandboxes/)
- [Docker Docs: Sandbox Security Model](https://docs.docker.com/ai/sandboxes/security/)
