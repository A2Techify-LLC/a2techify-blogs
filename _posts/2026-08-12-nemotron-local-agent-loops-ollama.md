---
layout: post
title: "Nemotron 3.5 Lightning Makes Local Agent Loops Worth Testing"
date: 2026-08-12 07:30:00 -0500
categories: [ai, local-agents]
tags: [nemotron, ollama, agents, local-ai, tool-calling]
sample_repo: "https://github.com/A2Techify-LLC/nemotron-local-agent-lab"
---

Ollama added NVIDIA Nemotron 3.5 Lightning this week, and the useful part is not just another model name in the catalog. It is a clear signal that local agents are being optimized for long-running tool work: gather context, call a tool, inspect the result, retry, and keep moving without sending every step to a hosted API.

NVIDIA describes Nemotron 3.5 Lightning as a 30-billion-parameter mixture-of-experts model with 3 billion active parameters per token. The model card lists up to a 1 million token context window and says the model is intended for long-running autonomous agents, sub-agent workhorse deployments, and efficient local inference on personal hardware.

<!--more-->

## What Happened

Ollama published "NVIDIA Nemotron 3.5 Lightning" on August 11, 2026. The post says the model is available through Ollama and can be started with:

```bash
ollama run nemotron-3.5-lightning
```

NVIDIA's launch post explains the bigger architecture around the release. Nemotron 3.5 Lightning is positioned as a smaller specialized worker inside agent systems, while larger models can still plan, orchestrate, or handle unusually hard steps. NVIDIA also released NeMo Switchyard, an open source routing library that can route agent requests across multiple model backends.

That routing idea matters because most agent steps are not equal. Searching notes, classifying an alert, extracting fields, or checking a simple calculation should not always require the biggest model available.

## Why It Matters

Agent workloads are mostly made of repeated small decisions. A coding assistant might read files, inspect a failing test, edit a small function, rerun the test, and summarize what changed. An operations assistant might search runbooks, classify an alert, check service status, and draft a response.

Those steps have three practical constraints:

- They can be high volume.
- They often touch private context.
- They need predictable tool boundaries.

A local model is attractive when you care about privacy, offline behavior, or avoiding per-token bills for repeated internal work. It is less attractive when the hardware is undersized or the workflow needs frontier reasoning on every step.

Nemotron 3.5 Lightning sits in the interesting middle: large enough to target agentic, coding, reasoning, tool-use, and long-context tasks, but designed so only 3B parameters are active per token.

## How The Technology Works

The model card describes a hybrid architecture that combines Mamba-2, mixture-of-experts layers, and selected attention layers. In simple terms, the model has 30B total parameters, but each token activates a smaller path through the model.

That is why the "3B active" number matters. It is the deployment argument: agents need throughput because a single user task may involve dozens or hundreds of model calls.

The model card also lists:

- context length up to 1M tokens,
- text input and output,
- support for English, Spanish, French, German, Italian, Japanese, and coding languages,
- deployment targets including DGX Spark or H100 for single-GPU deployment,
- OpenMDW 1.1 license terms.

For ordinary developers, the most practical starting point is Ollama. It hides most serving details and gives you a local HTTP API that a simple agent harness can call.

## Practical Example

Today's companion repo is a small local-first agent loop:

[A2Techify-LLC/nemotron-local-agent-lab](https://github.com/A2Techify-LLC/nemotron-local-agent-lab)

The sample intentionally avoids a heavy framework. It has:

- a chat adapter for Ollama's local API,
- a deterministic mock adapter for CI and small machines,
- a safe note-search tool,
- a safe arithmetic tool,
- a tiny plan, tool-call, summarize loop.

The agent asks the model for one JSON action:

```json
{"tool": "search_notes", "args": {"query": "deployment"}}
```

Then it runs the allowlisted local tool and asks the model to summarize the result. That is the smallest useful shape of a local agent: constrained planning, safe tools, observable output.

Run the sample without downloading a model:

```bash
python -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
pytest
nemotron-agent --mock "Find the deployment note and add 19 + 23"
```

Run it with Ollama when your machine has a model available:

```bash
ollama pull nemotron-3.5-lightning
nemotron-agent "Find the deployment note and add 19 + 23"
```

You can also point the same scaffold at a smaller local model:

```bash
OLLAMA_MODEL=qwen3:4b nemotron-agent "Summarize the deployment note"
```

## Cost And Operational Notes

Local inference does not mean free inference. You are trading API billing for hardware, power, memory, model storage, and operational care.

For this release, the hardware notes matter. The model card lists single-GPU deployment on DGX Spark or H100 and supported NVIDIA hardware including Blackwell, Hopper, and Ampere paths. That is not the same as saying every laptop can comfortably run it.

The practical rollout path is:

1. Build the agent loop in mock mode.
2. Test the loop with a small local model.
3. Add logging around tool plans, tool results, latency, and failures.
4. Try Nemotron 3.5 Lightning only on suitable hardware.
5. Route hard or risky steps to a stronger model instead of forcing one model to do everything.

Also treat tool access as production code. Local agents should still use allowlists, typed arguments, dry-run modes, and logs. "Runs on my device" is not a security boundary by itself.

## What To Watch Next

The bigger trend is model routing for agents. NVIDIA's Switchyard repo describes routing across OpenAI Chat, Anthropic Messages, and OpenAI Responses formats, with metrics for requests, errors, latency, tokens, and routing overhead.

That is where local agents get more useful: a cheap local worker handles routine steps, a stronger model handles planning or review, and the application records enough telemetry to know when routing decisions are working.

For builders, the next useful experiment is not a huge demo. It is a small tool loop with strict JSON, local context, clear logs, and one measurable task.

## References

- [Ollama: NVIDIA Nemotron 3.5 Lightning](https://ollama.com/blog/nemotron-3-5-lightning)
- [Ollama model page: nemotron-3.5-lightning](https://ollama.com/library/nemotron3.5-lightning)
- [NVIDIA Blog: Nemotron 3.5 Lightning and NeMo Switchyard](https://blogs.nvidia.com/blog/nemotron-lightning-switchyard-rtx-dgx/)
- [Hugging Face model card: NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4)
- [NVIDIA-NeMo/Switchyard](https://github.com/NVIDIA-NeMo/Switchyard)
- [A2Techify sample repo: Nemotron Local Agent Lab](https://github.com/A2Techify-LLC/nemotron-local-agent-lab)
