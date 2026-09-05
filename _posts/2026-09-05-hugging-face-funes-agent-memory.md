---
layout: post
title: "Hugging Face Funes Turns Agent Sessions Into Owned Memory"
date: 2026-09-05 07:30:00 -0500
categories: [ai, devtools]
tags: [agents, hugging-face, local-ai, devtools]
description: "Hugging Face's funes is a practical local-first memory layer for coding agents: index raw session traces, keep provenance, and share through a dataset only when you choose."
image: "/assets/images/posts/hugging-face-funes-agent-memory.png"
---

Hugging Face released `funes`, an open-source memory layer for coding agents. It indexes the session traces already sitting on a developer machine, gives agents recall and get tools, and can optionally sync that memory through a Hugging Face dataset repo the user owns.

The useful idea is not just "agents remember things." The useful idea is that memory is treated as a local, auditable artifact instead of a managed black box.

<!--more-->

## What Changed

`funes` is a single binary that currently supports Claude Code, Codex, pi, and Hermes. The `funes add <agent>` command wires recall tools into the agent, builds the first local index, and installs automation that keeps the memory current as sessions finish.

The index is built from raw agent traces. Hugging Face says the pipeline parses supported sessions into a common turn-and-block shape, chunks the content, embeds it with a pinned local model, writes it into a local Lance dataset, and uses hybrid vector plus BM25 retrieval with reranking at query time.

That means the memory is not an LLM-written summary. Recall returns source passages with provenance: agent, timestamp, session, turn, and a command to inspect more context. If a later agent asks why a team moved away from an approach, it can retrieve the original discussion instead of trusting a stale handoff note.

The optional sharing model is also interesting. A user can bind the memory to a Hugging Face dataset repo, private by default when `funes` creates it. Other machines or teammates can recall from that dataset, while embedding and reranking still happen locally after files are cached.

## Why We're Paying Attention

Small teams are about to have more agent traces than documentation.

Coding agents read files, try commands, hit failures, test assumptions, and explain tradeoffs. A lot of the best engineering context now lives in those transcripts: why a parser changed, which migration failed, what deployment check caught a bad assumption, or why a security boundary was drawn in a particular place.

Most of that context disappears from the next session. The common fixes are weak:

- Keep stretching one long context window until it gets expensive and fragile.
- Ask the agent to write a handoff and hope it preserved the detail that will matter later.
- Save a polished decision doc, which is useful but usually misses the dead ends.
- Use a memory service that distills conversations into mutable facts without preserving the raw evidence.

`funes` picks a different contract. It keeps the raw record, makes retrieval local by default, and lets the current agent interpret the evidence when it needs it. That is a better match for engineering work, where the question is often not "what is the current fact?" but "what did we try, what broke, and why did we decide this was the less bad option?"

## How It Works

The design has four practical boundaries worth copying even if a team never adopts `funes` directly.

First, ingest is deterministic. The indexer does not ask a model to summarize the transcript into memories. It stores chunks of the original trace, so a bad recall can be debugged against the source.

Second, the memory is append-only. Old passages are not overwritten when a newer decision appears. Recency can influence ranking, and the reader can judge which passage matters now, but the system does not silently delete the trail that explains how the team got there.

Third, retrieval is pulled on demand. There is no permanent memory block stuffed into every prompt. The agent or developer asks for recall when the task touches prior work, and the returned passages enter context only then.

Fourth, sharing is storage, not a hosted reasoning service. A shared memory is a Hugging Face dataset repo. The Hub provides ownership, access control, versioning, distribution, and caching. The local machine still runs the embedding and reranking path for queries.

That separation matters. Memory of agent sessions can include internal architecture, unfinished bugs, credentials accidentally printed into terminals, customer context, and security findings. Treating it as a dataset makes the custody question explicit.

## A Small Useful Test

This post does not need a sample repo. The best test is to try the tool against the traces your agents already have, or to use the public `huggingface/funes-memory` dataset for a read-only query.

For a local setup, start with one agent and keep it local:

```bash
funes add codex
funes status
```

Then ask a question that should only be answerable from past work:

```bash
funes recall "why did we change the deployment health check"
```

For a one-off read of a shared memory, avoid binding it as a default. Query it directly:

```bash
funes recall "why is funes append-only" --memory huggingface/funes-memory
```

The useful evaluation is not whether the answer sounds fluent. Look for three things:

- Did recall return the exact passage that supports the answer?
- Can you inspect the surrounding turn when the snippet is ambiguous?
- Does the system clearly miss when the memory does not contain enough evidence?

If the answer cannot be traced back to a real session, it is not memory. It is just another generated note.

## Cost And Operational Notes

Local-only `funes` avoids a paid API for indexing and retrieval. Hugging Face says its default inference backend has no separate ML runtime dependency, with local embedding and reranking. Building from source requires a Rust toolchain and `protoc`, but the prebuilt binary path is meant to be the normal install route.

The operational cost is mostly data hygiene.

Agent traces are sensitive. They can contain command output, private paths, internal URLs, debugging notes, and secrets that were accidentally exposed during a session. `funes` documents three protections for publishing: redaction during indexing, a publish-time TruffleHog gate that fails closed, and `funes scrub` for local cleanup. Those are good boundaries, but they do not make shared memory risk-free.

Before binding a team memory, decide:

- Which agents and machines are allowed to publish.
- Whether the dataset should stay private or be public for an open-source project.
- Which tokens have write access and which machines only need read access.
- What happens if a credential was already captured in an old session.
- Whether third-party memories are trusted enough to enter an agent's context.

That last point is easy to miss. Recalled passages become prompt input. A memory published by someone else can carry prompt-injection text just like a web page or issue comment. For untrusted memories, prefer explicit one-off recall and inspect the returned passages before using them in an automated workflow.

## What We'd Watch Next

The strongest version of agent memory probably combines two layers.

One layer should preserve the raw trace with provenance, as `funes` does. The other can synthesize stable project knowledge, decision records, owner maps, and architectural summaries. The raw layer keeps the synthesis honest. The synthesis layer makes the memory easier to navigate.

The important shift is that agent memory is becoming an artifact teams can own, move, audit, and rebuild. That is healthier than treating memory as a private feature hidden inside one coding assistant.

For small teams, the starting point is simple: index one agent locally, ask for one past decision, and check whether the returned evidence would have saved time in a fresh session. If it would, agent traces have crossed the line from disposable logs into working infrastructure.

## References

- [Hugging Face Blog: Give Your Coding Agents a Memory You Own](https://huggingface.co/blog/funes)
- [GitHub: huggingface/funes](https://github.com/huggingface/funes)
- [funes SECURITY.md](https://github.com/huggingface/funes/blob/main/SECURITY.md)
- [funes add documentation](https://github.com/huggingface/funes/blob/main/docs/add.md)
- [funes rationale](https://github.com/huggingface/funes/blob/main/docs/RATIONALE.md)
- [Lance](https://github.com/lancedb/lance)
