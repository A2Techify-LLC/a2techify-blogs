---
layout: post
title: "OpenAI Agents SDK Makes Sandboxes A First-Class Boundary"
date: 2026-09-02 07:30:00 -0500
categories: [ai, devtools]
tags: [agents, devtools, security, infrastructure]
description: "OpenAI's Agents SDK update is a practical reminder that production agents need explicit workspaces, isolated compute, durable state, and credential boundaries."
image: "/assets/images/posts/openai-agents-sdk-sandbox-boundary.png"
---

OpenAI updated the Agents SDK with a more capable harness for file-and-tool work, plus native sandbox execution. The useful part is not that agents can run commands. Teams have been wiring that together for a while.

The useful part is that the SDK is treating the agent workspace as a real production boundary: files are mounted intentionally, outputs have a defined place to land, compute can be isolated, and agent state can survive a container going away.

<!--more-->

## What Changed

OpenAI says the Agents SDK now includes a model-native harness with configurable memory, sandbox-aware orchestration, Codex-like filesystem tools, MCP tool use, skills, `AGENTS.md` instructions, shell execution, and structured file editing through apply patch.

The SDK also adds native sandbox execution. Developers can bring their own sandbox or use provider integrations listed by OpenAI, including Blaxel, Cloudflare, Daytona, E2B, Modal, Runloop, and Vercel.

The key abstraction is a workspace manifest. OpenAI describes it as a way to mount local files, define output directories, and connect data from storage providers such as S3, Google Cloud Storage, Azure Blob Storage, and Cloudflare R2. That gives the agent a predictable place to read inputs and write results whether it is running locally or in a production sandbox.

## Why We're Paying Attention

Most agent prototypes hide their riskiest design choices in glue code.

One script passes a folder path. Another exposes a shell. A third loads an MCP server. A fourth keeps a transcript in a database. Eventually the agent can read a lot, write a lot, and call tools with credentials the team did not mean to expose.

OpenAI's update is interesting because it names the runtime pieces that small teams should make explicit before they let agents touch real work:

- What workspace does the agent see?
- Which files are read-only, writable, or output-only?
- Where does long-running state live?
- Which process holds secrets?
- Which process runs model-generated code?
- What gets logged at tool, network, and file boundaries?
- How does the run resume if the sandbox expires?

That is the difference between a useful internal worker and a powerful script with unclear edges.

## How It Works

The updated model separates the harness from the compute environment.

The harness owns the agent loop: instructions, memory, tool orchestration, resumable state, and coordination across files and tools. The sandbox owns execution: a controlled computer environment where the agent can inspect files, install dependencies, run code, and write outputs for a bounded task.

That split matters for security. OpenAI explicitly says agent systems should assume prompt-injection and exfiltration attempts. If credentials live inside the same environment where model-generated commands run, the agent can be tricked into looking for them, printing them, or sending them somewhere else.

Keeping harness state and credentials outside the compute sandbox gives teams a cleaner boundary. The sandbox can be disposable. The harness can snapshot and rehydrate the run. The agent can continue after a container failure without giving the execution environment permanent access to everything the application knows.

The same pattern helps scale. A workflow can use a sandbox only when it needs one, route subagents into separate environments, or parallelize independent work across containers instead of turning one long-running shell into the center of the system.

## A Small Useful Test

This post does not need a sample repo. A repo would mostly wrap OpenAI's SDK docs and create maintenance work. The better starting point is a sandbox contract that your team can review before writing production glue.

Use a short manifest sketch like this:

```yaml
agent_workspace:
  purpose: "Investigate one support export and draft a summary"
  inputs:
    - name: "case-export"
      source: "object-storage"
      mount: "/workspace/input"
      access: "read-only"
  outputs:
    - name: "summary"
      mount: "/workspace/output"
      access: "write-only-result"
  tools:
    shell:
      enabled: true
      network: "disabled-by-default"
    mcp:
      allowed_servers:
        - "case-metadata-readonly"
  secrets:
    available_to_sandbox: false
    available_to_harness: true
  durability:
    snapshot: "after-each-tool-call"
    resume_policy: "rehydrate-in-fresh-sandbox"
  review:
    human_approval_required_for:
      - "external_message"
      - "customer_record_update"
```

Then turn it into a release checklist:

```text
Agent sandbox review

1. Can the agent finish the task with read-only inputs?
2. Are output paths separate from input paths?
3. Does the sandbox need network access, or only specific egress?
4. Can model-generated code see API keys, tokens, SSH material, or cloud credentials?
5. Are MCP servers running inside the sandbox or behind a trusted boundary?
6. What exact artifacts survive after the sandbox is destroyed?
7. Can a failed run resume without replaying unsafe side effects?
8. Is every tool call logged well enough for incident review?
```

If the team cannot answer those questions, the agent is not ready for production writes yet.

## Cost And Operational Notes

OpenAI says these Agents SDK capabilities are generally available through the API and use standard API pricing based on tokens and tool use. That means the sandbox feature is not a magic cost boundary. Long-running tasks can still spend money through model calls, tool calls, retries, and oversized context.

The operational cost also moves into infrastructure choices:

- Hosted sandboxes are convenient, but teams still need retention, network, logging, and data-location policies.
- Bring-your-own sandboxes give more control, but someone has to patch images, manage isolation, and monitor resource use.
- Snapshotting helps durability, but snapshots can become sensitive records.
- Mounting object storage is practical, but broad buckets can accidentally turn one agent task into a data exposure risk.
- Parallel sandboxes can speed up work, but they multiply logs, rate limits, and failure modes.

For small teams, the first production version should be boring: one agent, one narrow workspace, one read-only data source, one output directory, no sandbox-visible secrets, and explicit approval before anything leaves the system.

## What We'd Watch Next

The next important step is whether this workspace-manifest idea becomes portable across agent stacks. Teams do not want every sandbox provider, model SDK, CI system, and MCP gateway to invent a different vocabulary for inputs, outputs, secrets, and durable state.

The pattern is bigger than one SDK release. Agents are becoming software that operates inside controlled workspaces. The teams that treat those workspaces as deployable infrastructure will have an easier time debugging, securing, and scaling agent work.

The main takeaway is simple: do not start production agent design with the prompt. Start with the boundary.

## References

- [OpenAI: The next evolution of the Agents SDK](https://openai.com/index/the-next-evolution-of-the-agents-sdk/)
- [OpenAI Developers: Agents SDK](https://developers.openai.com/api/docs/guides/agents)
- [OpenAI Developers: Shell tool](https://developers.openai.com/api/docs/guides/tools-shell)
- [OpenAI Developers: Apply Patch tool](https://developers.openai.com/api/docs/guides/tools-apply-patch)
