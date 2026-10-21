---
layout: post
title: "llama.cpp v0.7.0 Adds a GPU Cache for CPU-Offloaded MoE Experts"
date: 2026-10-21 01:30:00 -0500
categories: [ai, engineering]
tags: [local-ai, quantization, gpu-management]
description: "llama.cpp v0.7.0 can cache frequently used MoE experts on the GPU while keeping the full expert set in system memory."
image: "/assets/images/posts/llama-cpp-moe-gpu-cache.png"
---

llama.cpp v0.7.0 adds a useful middle ground for large mixture-of-experts models: keep the expert weights in system memory, but cache the experts used most often in VRAM.

The new `--moe-cache-mib` option creates an LRU cache on the GPU. Instead of moving every selected expert across the CPU-to-GPU link for every token, llama.cpp uploads an expert on a cache miss and reuses it while it remains hot. For models that are too large to keep fully in VRAM, this can improve generation speed without requiring another GPU.

<!--more-->

## What Changed

The v0.7.0 release introduces a GPU cache specifically for MoE experts that remain in host memory. It works with llama.cpp's existing CPU-offload controls:

- `--cpu-moe` keeps all MoE expert weights on the CPU;
- `--n-cpu-moe N` keeps the experts for the first `N` layers on the CPU;
- `--moe-cache-mib N` reserves `N` MiB of GPU memory for frequently used CPU-resident experts;
- `--fit` includes the cache in its VRAM calculation and adjusts other placement choices around it.

The implementation uses separate cache banks for layers with different expert layouts. With multiple GPUs, llama.cpp splits the cache using the same proportions as `--tensor-split`.

This is a decode optimization, not a new quantization format. The model still needs enough combined RAM and VRAM to load, and a cache miss still transfers an expert over the host-device connection.

## Why We're Paying Attention

Sparse MoE models reduce the compute used for each token by activating only a subset of their experts. Their complete expert weights can still be large. When those weights spill into system memory, decode speed can become limited by repeated transfers rather than raw GPU compute.

The new cache targets that exact gap. Expert routing is not uniformly random: some experts are selected often enough that keeping them in VRAM can avoid repeated uploads.

In the merged llama.cpp pull request, a Qwen3.8-Flash-Next Q4_0 model had 65.4 GiB of expert weights inside a 93.7 GiB model. On the test system, adding a 6.4 GiB expert cache increased generation from 25.0 to 39.4 tokens per second on an RTX 4090, a 1.57x improvement. An RTX 5090 configuration with an 18.6 GiB cache reached 67.8 tokens per second versus a 30.8-token baseline, a 2.20x improvement.

Those are project measurements from one model, prompt set, CPU, PCIe configuration, and cache policy. They show the feature can matter; they do not promise the same multiplier on every MoE model or machine.

## How The Cache Works

During small-batch generation, llama.cpp runs the matrix operations for host-resident experts on the GPU. The cache keeps recently used experts in VRAM and uploads only misses. The implementation currently applies this path to batches of 32 tokens or fewer; larger batches use the regular offload path.

That makes the feature most relevant to token-by-token decode and small concurrent workloads. Prompt ingestion and heavily batched serving can have a different bottleneck.

The pull request's starting recommendation is to allocate about 10% of the total expert-weight size to the cache. Treat that as a benchmark starting point, not a fixed rule. A larger cache can raise the hit rate, but every MiB reserved for experts is VRAM unavailable to model layers, KV cache, context, and concurrent slots.

## A Small A/B Test

This does not need a sample repository. Two server commands and one repeatable prompt are enough to find out whether the cache helps on a specific machine.

First, pin llama.cpp v0.7.0 and run a baseline with the normal automatic fit behavior:

```bash
llama-server \
  -m /path/to/moe-model.gguf \
  --fit on \
  --ctx-size 32768 \
  --port 9931
```

Then run the same model and settings with a modest cache. This example reserves 4 GiB; choose a lower value if the baseline already leaves little VRAM free.

```bash
llama-server \
  -m /path/to/moe-model.gguf \
  --fit on \
  --moe-cache-mib 4096 \
  --ctx-size 32768 \
  --port 9931
```

Send the same deterministic request to each run:

```bash
curl http://127.0.0.1:9931/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [{
      "role": "user",
      "content": "Explain B-tree page splits to a backend engineer in 400 words."
    }],
    "temperature": 0,
    "max_tokens": 512
  }'
```

Run each configuration several times after warm-up. Record:

```text
prompt processing tokens/second
generation tokens/second
time to first token
peak VRAM and system RAM
whether --fit moved more full layers back to the CPU
stability across repeated requests
```

The winning setting is not necessarily the largest cache. Increase the cache in small steps, keep the prompt and output length fixed, and stop when throughput flattens or context capacity suffers.

## Cost And Operational Notes

The feature is local and open source, so there is no API charge. The operational cost is hardware capacity and tuning time.

- **VRAM remains a shared budget.** The expert cache competes with layer offload, KV cache, and parallel requests.
- **System RAM still holds the offloaded experts.** Caching does not shrink the model or eliminate host-memory bandwidth requirements.
- **PCIe and unified memory behave differently.** A discrete GPU crossing PCIe may see a different gain from an Apple or AMD system with unified memory.
- **Batch size matters.** The optimized cache path is currently for batches no larger than 32 tokens.
- **Model routing matters.** A workload with concentrated expert use can produce a higher hit rate than one that spreads requests across many experts.
- **Pin the runtime.** v0.7.0 also changes `llama-server`'s default host port from 8080 to 9931. Docker images continue to use port 8080 internally, so existing health checks and proxy mappings should be reviewed during an upgrade.

Keep the service bound to loopback unless remote access is intentional and protected. If it is part of an agent stack, test tool calls and long-running sessions as well as a single text-generation benchmark.

## What We'd Watch Next

The first useful community data will be cache-size curves across different MoE families and hardware links, not isolated peak numbers. We would especially watch whether hit rates stay stable across mixed workloads and multiple concurrent users.

We would also measure the interaction with quantization and context size. A slightly smaller expert cache may be the better production choice if it preserves more KV cache or keeps another model layer on the GPU.

For now, `--moe-cache-mib` is a practical knob for a common local-inference problem: the model fits across RAM and VRAM, but CPU-offloaded experts make decoding too slow. Benchmark it before buying hardware, and keep the configuration only if the end-to-end workload improves.

## References

- [llama.cpp v0.7.0 release notes](https://github.com/ggml-org/llama.cpp/releases/tag/v0.7.0)
- [Merged implementation: GPU cache for MoE experts](https://github.com/ggml-org/llama.cpp/pull/29887)
- [llama.cpp server documentation for v0.7.0](https://github.com/ggml-org/llama.cpp/blob/v0.7.0/tools/server/README.md)
- [Default server port change](https://github.com/ggml-org/llama.cpp/pull/30159)
