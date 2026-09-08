---
layout: post
title: "VS Code Agent Merge Turns PR Cleanup Into An Agent Loop"
date: 2026-09-08 07:30:00 -0500
categories: [ai, devtools]
tags: [agents, vscode, devtools, ci]
description: "VS Code 1.136 adds Agent Merge in preview, giving coding agents a narrower loop for review feedback, failing checks, stale branches, and merge conflicts."
image: "/assets/images/posts/vscode-agent-merge-pr-cleanup.png"
---

Visual Studio Code 1.136 adds a preview feature called Agent Merge. The idea is simple: once an agent has a pull request open, VS Code can keep asking it to handle the boring finish-line work until the PR is ready.

That finish-line work is where many agent demos quietly fall apart. Writing the first diff is only part of the job. A useful coding agent also has to respond to review feedback, deal with failed checks, update a stale branch, resolve conflicts, and know when to stop before it turns a small PR into a risky automation loop.

<!--more-->

## What Changed

VS Code 1.136 was released on September 2, 2026. The release notes say this version focuses on finishing pull requests with agents and managing agent work across complex workspaces and related chats.

The headline agent feature is Agent Merge, currently in preview behind the `chat.agentMerge.enabled` setting. Microsoft says Agent Merge asks an agent to address review feedback, fix failed checks and merge conflicts, and rerun workflows until the pull request is ready to merge.

The Agents window documentation gives the more operational view. Agent Merge monitors the pull request associated with an agent session and can ask the agent to address review comments, fix check failures, update a branch that is behind its base branch, resolve merge conflicts, and optionally merge or enqueue the PR when it is ready.

VS Code also added agent session hierarchy, multi-root workspace support for Copilot and Claude sessions, notifications for agent sessions that need attention, and better workspace resolution. Those are useful, but Agent Merge is the sharper item because it turns the last mile of a PR into an explicit product surface.

## Why We're Paying Attention

Small teams do not need an agent that only creates more review work. They need an agent that can close loops without hiding important decisions.

The last mile of a PR is repetitive, stateful, and tool-heavy:

- fetch the latest review comments;
- inspect failing CI logs;
- make a smaller follow-up patch;
- rerun the relevant workflow;
- rebase or merge the base branch;
- resolve conflicts without losing the review context;
- decide whether the PR is actually ready.

That is exactly the kind of workflow where an agent can help, but only if the boundary is clear. Agent Merge is interesting because VS Code is not framing the agent as a magical merge button. The docs call out configuration, blockers, Autopilot, Assisted permissions, required checks, branch tracking, and a final readiness check before merging or adding to a merge queue.

## How It Works

The feature starts from an active agent session in the Agents window. After enabling `chat.agentMerge.enabled`, the user can enable Agent Merge for that session from the title bar or command palette.

From there, Agent Merge monitors the pull request tied to the session. Depending on the configured options, it can start more agent turns, change and sync the PR branch, wait while required checks are pending, rerun work after blockers appear, and check readiness before merge.

The important design detail is that enabling Agent Merge changes the session into Autopilot with Assisted permissions. In practice, that means the agent gets more room to keep working, while the environment still has a permission model around sensitive operations. Teams should read the Agent Merge options before enabling automatic merging, especially on repositories with deployment workflows or protected branches.

This also connects back to VS Code's Agent Host direction. Long-running PR cleanup needs durable session state, access to the worktree, workflow status, related chats, and a review surface. The agent cannot live only inside one transient chat box and still be useful for this kind of work.

## A Small Useful Test

This post does not need a sample repo. A repo would be a fake PR harness, not the real thing. The better test is to try Agent Merge on one low-risk pull request and write down exactly what it is allowed to do.

Before enabling it, use a short policy like this:

```text
Agent Merge pilot

Repository: internal docs or non-critical tooling repo
Allowed blockers: review comments, formatter failures, unit test failures
Not allowed: production deploy fixes, dependency upgrades, auth changes
Merge behavior: never auto-merge during the pilot
Required review: human reviews final diff after all agent turns
Stop condition: disable Agent Merge if the branch or PR association changes
Evidence to capture: review comments handled, checks rerun, commits added, final diff
```

Then run one PR through the loop. The result to inspect is not whether the agent looked busy. The result is whether it made a focused patch, preserved the original intent of the PR, responded to the actual blocker, and left a reviewable final diff.

## Cost And Operational Notes

Agent Merge can consume model requests while it waits, reruns checks, and starts additional agent turns. That is not a reason to avoid it, but it is a reason to pilot it on small PRs before turning it loose on a busy repository.

The CI side matters too. If every agent iteration reruns a full integration suite, the hidden cost may be runner minutes rather than model tokens. Teams should prefer targeted checks while the agent is still fixing obvious issues, then rely on protected-branch checks for the final gate.

The risk boundary is merge authority. Automatic cleanup is useful; automatic merging is a separate decision. Keep auto-merge off until the team has seen enough runs to trust the behavior, and even then limit it to repositories with strong branch protection, required checks, CODEOWNERS, and rollback paths.

There is also a workflow risk: an agent can chase symptoms. If a failing check points to an unclear product decision, a flaky test, or a migration that affects production data, the right answer is often to stop and ask for human judgment. Agent Merge should be a loop for bounded blockers, not a way to outsource ownership of the change.

## What We'd Watch Next

The useful next layer is traceability. Teams will want a clean record of what Agent Merge saw, which blockers it decided to address, which commands or checks it ran, which commits it added, and why it believed the PR was ready.

We would also watch how this behaves with multi-root workspaces and related chats. VS Code 1.136 adds more structure around agent sessions, but PR cleanup across several folders can still be tricky. The agent needs the right workspace context, the right CI logs, and the right branch association.

For small teams, the practical move is cautious adoption: use Agent Merge as a PR cleanup assistant, not as a default merge authority. Let it handle repetitive blockers. Keep branch protection and human review in charge of the final decision.

## References

- [Visual Studio Code 1.136 release notes](https://code.visualstudio.com/updates/v1_136)
- [VS Code Docs: Use the Agents window](https://code.visualstudio.com/docs/agents/run/agents-window#_finish-a-pull-request-with-agent-merge)
- [VS Code Docs: Agent Host architecture](https://code.visualstudio.com/docs/agents/concepts/agent-host)
- [VS Code Blog: Introducing the Agent Host for persistent, portable agent sessions](https://code.visualstudio.com/blogs/2026/08/26/agent-host-architecture)
