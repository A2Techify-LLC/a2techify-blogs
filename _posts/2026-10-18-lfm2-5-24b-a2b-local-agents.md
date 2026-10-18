---
layout: post
title: "LFM2.5-24B-A2B Brings Faster Reasoning Agents to Local Hardware"
date: 2026-10-18 07:30:00 -0500
categories: [ai, engineering]
tags: [local-ai, agents, quantization]
description: "Liquid AI's open-weight LFM2.5-24B-A2B activates 2B of its 24B parameters per token, supports tool use, and ships in formats for local agent runtimes."
image: "/assets/images/posts/lfm2-5-24b-a2b-local-agents.png"
---

Liquid AI has released LFM2.5-24B-A2B, an open-weight reasoning model aimed at agents that run on local hardware. It has 24 billion parameters in total, but its mixture-of-experts architecture activates about 2.45 billion per token.

That distinction matters. The model still needs memory for its full set of weights, but each generated token uses a much smaller active path. The result is a model designed to make multi-step reasoning and tool use faster without pretending that a 24B checkpoint has the footprint of a dense 2B model.

<!--more-->

## What Changed

LFM2.5-24B-A2B is the largest and final model in Liquid AI's LFM2.5 family, combining a reasoning-first checkpoint with broad support across local inference runtimes.

Its core specifications include:

- 24B total parameters and 2.45B active parameters;
- 64 experts per mixture-of-experts block with top-4 routing;
- a 131,072-token context window;
- a 128,000-token vocabulary covering 16 listed languages;
- native function calling and multi-turn tool use;
- official Transformers, llama.cpp, MLX, vLLM, SGLang, and ONNX support.

Liquid AI also publishes a base checkpoint, an FP8 build, a GGUF repository for quantized local inference, an ONNX build, and a 4-bit MLX build for Apple Silicon. The post-trained checkpoint is the one intended for agents.

Compared with the earlier LFM2-24B-A2B, the context window grows from 32K to 131K and the vocabulary doubles from 65K to 128K. The new model always reasons before answering, and Liquid AI says its post-training included agentic reinforcement learning inside OpenClaw, Hermes Agent, Pi, and OpenCode.

## Why We're Paying Attention

Local agents need more than a model that writes plausible text. They need stable instruction following, reliable tool-call formatting, enough context for the harness and task history, and acceptable latency across many turns.

LFM2.5-24B-A2B is built around that workload. Liquid AI reports that it leads or matches the compared models on five of eight tool-use and agent benchmarks. It reports a LiveClaw score of 48.09, compared with 38.19 for Qwen3.6-35B-A3B, and a ToolSandbox score of 80.71, compared with 75.02.

Those are vendor-run evaluations, not a guarantee for a particular machine or tool stack. The broader result is still useful: this is an open-weight model released with agent harness configuration, function-calling documentation, and local inference formats on day one.

The trade-off is visible in the same benchmark table. Larger models remain stronger on several knowledge-heavy and coding evaluations. On SWE-Bench Verified with OpenCode, Liquid AI reports 51.0 for LFM2.5-24B-A2B and 66.2 for Qwen3.6-35B-A3B. This looks more like a fast local tool user than a universal replacement for a stronger hosted coding model.

## How The Efficiency Works

The `A2B` name means roughly 2B parameters are active for each token even though the checkpoint contains 24B. Its mixture-of-experts blocks hold many specialized parameter groups, while the router selects four experts for the current token.

That reduces compute per generated token. It does not remove the other costs:

- The full weights still have to live in RAM, unified memory, VRAM, or a combination of them.
- A long context window needs a larger key-value cache.
- Agent loops can generate many reasoning tokens before producing a final answer.
- Tool definitions, results, and conversation history all consume context.

Liquid AI's headline edge numbers use a Q4_K_M quantization and a 4K-token input: 184 tokens per second on an Apple M5 Max and 114 on an AMD Ryzen AI Max+ 395. Treat those as reference points for that exact setup, not expected performance on every laptop.

The practical benefit of the architecture is throughput after the model fits. Quantization and a smaller served context are still the main levers for fitting it onto constrained hardware.

## A Small Local Test

This post does not need a sample repository. The useful test is to serve the official GGUF through llama.cpp, check the OpenAI-compatible endpoint, and exercise one harmless tool call in the agent harness you already use.

With a current llama.cpp build, start by serving the official GGUF repository:

```bash
llama-server \
  -hf LiquidAI/LFM2.5-24B-A2B-GGUF \
  --jinja \
  --port 8080 \
  -c 32768 \
  --temp 0.1 \
  --top-k 50 \
  --repeat-penalty 1.05
```

`--jinja` is important because it enables the model's tool-calling template. The example deliberately starts with a 32K context instead of allocating the full 131K window. Raise it only after measuring memory use on your hardware.

Confirm that the server is reachable:

```bash
curl http://localhost:8080/v1/models
```

Then point an OpenAI-compatible agent harness at `http://localhost:8080/v1` and use the model ID returned by that endpoint. Start with a read-only task that needs one obvious tool call, such as listing a temporary directory and summarizing the filenames.

Measure more than tokens per second:

```text
tool selected correctly
arguments match the schema
tool result is used in the answer
no invented success after a failed call
peak memory remains stable across several turns
context does not truncate task-critical instructions
```

If the model describes a tool call instead of emitting one, verify that the server loaded the chat template and that the harness is passing tool definitions. Tool-use failures are often integration failures before they are model-quality failures.

## Cost And Operational Notes

The weights are free to download and local inference avoids per-token API charges. It is not cost-free: disk, memory, electricity, cooling, setup time, and slower task completion all count.

Plan around the total 24B checkpoint, not the 2B active number. Choose a quantized GGUF or MLX build when memory is the constraint, and test the quality impact on the exact tools your agent uses. Liquid AI also publishes a quantization-aware-distilled Q4_0 GGUF intended to recover some accuracy lost at that quantization level.

Long context is another budget. Serving 131K because the model supports it can waste memory when a 16K or 32K window covers the task. Set a smaller default, monitor truncation, and increase it for workloads that prove they need more.

For operational use:

- keep the inference endpoint bound to loopback unless remote access is intentional and authenticated;
- pin the model revision and runtime version after validation;
- record the quantization, context length, sampling settings, and tool parser used in tests;
- test permission boundaries and failed-tool behavior before enabling write actions;
- pair the model with retrieval or web search for knowledge-heavy tasks, as Liquid AI recommends;
- keep a stronger fallback for difficult coding, research, or long-horizon tasks.

Local execution can improve privacy, but only if the whole path is local. A local model connected to remote search, telemetry, browser, or storage tools can still send data off the machine.

## What We'd Watch Next

The first question is whether the benchmark strength survives real harness integrations across quantizations. Tool-call syntax can look good in a controlled evaluation and still fail when schemas are large, tool results are messy, or the context contains conflicting instructions.

We would also watch memory and quality at the quantizations people can actually run. Fast decoding on high-end Apple and AMD systems is encouraging, but the more useful community data will show which 4-bit and 6-bit builds remain dependable on 16 GB, 32 GB, and 64 GB machines.

For now, LFM2.5-24B-A2B is a credible candidate for local agent routing: use it for frequent tool-driven work, measure it against your own tasks, and keep the execution boundary as explicit as the model choice.

## References

- [Liquid AI: LFM2.5-24B-A2B release](https://www.liquid.ai/blog/lfm2-5-24b-a2b)
- [Hugging Face model card: LFM2.5-24B-A2B](https://huggingface.co/LiquidAI/LFM2.5-24B-A2B)
- [Official GGUF checkpoint and llama.cpp example](https://huggingface.co/LiquidAI/LFM2.5-24B-A2B-GGUF)
- [Liquid AI docs: Run local agents with LFMs](https://docs.liquid.ai/examples/agent-harnesses)
