---
layout: post
title: "A Workable Artifact Layout for LeRobot Training Runs"
date: 2026-08-14 07:30:00 -0500
categories: [ai, engineering]
tags: [lerobot, hugging-face, storage-buckets, agents, robotics, devtools]
sample_repo: "https://github.com/A2Techify-LLC/lerobot-bucket-manifest-lab"
description: "Using manifests, checksums, and Hugging Face Storage Buckets to keep mutable robotics runs under control."
image: "/assets/images/posts/lerobot-storage-buckets-agent-artifacts.png"
modified: 2026-08-16 07:12:00 -0500
---

Hugging Face's August 13 robotics workflow, "Record, train, and deploy from one place with Strands Agents, LeRobot, and Hugging Face Storage Buckets," points at a very practical problem. Robot learning teams need a clean place for changing run artifacts while agents record data, train policies, review logs, and prepare deployments.

LeRobot already gives robotics projects a shared dataset and control vocabulary. Storage Buckets add mutable, S3-like object storage on the Hub for checkpoints, logs, intermediate artifacts, and other working files that do not belong in Git history.

<!--more-->

## What changed

Hugging Face listed a new August 13 blog post about recording, training, and deploying with Strands Agents, LeRobot, and Hugging Face Storage Buckets. The Hugging Face blog index showed the title and date; the detailed technical pieces are documented in the official LeRobot repository, the Storage Buckets documentation, and the Strands Agents SDK repository.

LeRobot is Hugging Face's open-source robotics library for real-world robot learning in PyTorch. Its repository describes three builder-facing pieces:

- a hardware-agnostic Python interface for robot control,
- a standardized LeRobotDataset format using Parquet plus MP4 or images,
- policy tooling for imitation learning, reinforcement learning, VLA models, world models, and reward models.

Storage Buckets are a Hub repo type for S3-like object storage, backed by Xet. Unlike model, dataset, or Space repositories, buckets are non-versioned and mutable. Hugging Face positions them for training checkpoints, logs, intermediate artifacts, and large collections of files that change often.

Strands Agents is an open-source SDK for building agent harnesses in Python and TypeScript. Its repository emphasizes model-agnostic agents, hooks, guardrails, tracing, MCP, structured output, and local-to-production workflows.

## Why we're paying attention

Robot learning generates messy working state. A single experiment can produce short videos, sensor traces, action logs, model checkpoints, evaluation summaries, and notes from failed runs. Some of that should become a curated dataset or model. Much of it is operational scratch space.

That distinction matters for agent workflows. An agent that helps with robot data collection or training needs somewhere to put intermediate files without pretending every artifact is a finished dataset release. Buckets give the workflow a mutable workbench; repositories remain the place for versioned code, model cards, dataset cards, and reviewed artifacts.

For small teams, this is especially practical because the first useful step does not require buying a robot arm or wiring a production pipeline. You can standardize run layout, manifests, validation, and dry-run sync commands locally before touching cloud storage.

## How it works

LeRobot's dataset pattern separates synchronized robot observations and actions into a standard format. The official repository describes Parquet files for state/action data and MP4 or images for vision data, with Hub integration for storage, streaming, and visualization.

Storage Buckets fill a different role. They are mutable object stores accessed through the Hub UI, the `hf` CLI, Python APIs, `hf://buckets/` paths, and S3-compatible tooling. The documentation is explicit that buckets are not versioned and do not have pull requests, which is exactly why they fit checkpoints and logs better than reviewed releases.

An agent harness such as Strands can sit above that storage layer. The agent can inspect a run manifest, decide whether required artifacts exist, launch a training or validation tool, and prepare a sync plan. The important control point is that the agent should operate on manifests and dry-run plans before it uploads, deletes, or overwrites anything.

## A small test

We built a small companion repo around that operating pattern:

[A2Techify-LLC/lerobot-bucket-manifest-lab](https://github.com/A2Techify-LLC/lerobot-bucket-manifest-lab)

It is intentionally small. The repo creates a tiny synthetic robot-run artifact tree, writes a manifest with file sizes and SHA-256 checksums, validates the manifest, and prints safe `hf buckets sync` commands.

Run it locally:

```bash
git clone https://github.com/A2Techify-LLC/lerobot-bucket-manifest-lab.git
cd lerobot-bucket-manifest-lab
python -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"

python -m robot_bucket_manifest demo --out sample-output
python -m robot_bucket_manifest validate sample-output/manifest.json
python -m robot_bucket_manifest sync-plan sample-output hf://buckets/YOUR_USER/robot-runs/so100/pick-cube/2026-08-14-demo
pytest
```

The smoke test validates the manifest path and intentionally checks that modified artifacts fail validation. The sample avoids real robot hardware, hosted model calls, secrets, and paid APIs.

## What the repo covers

The layout is the pattern:

```text
hf://buckets/<owner>/<bucket>/robot-runs/<robot>/<task>/<run-id>/
  manifest.json
  episodes/
  checkpoints/
  logs/
```

That gives an agent a stable contract. Before training, it can verify that required episodes exist. After training, it can check that a checkpoint and log were written. Before upload, it can print or review a dry-run sync plan.

The manifest is deliberately simple JSON. It is not a replacement for LeRobotDataset metadata; it is an operational checklist for mutable run artifacts.

## Before you ship it

The sample repo is free to run locally. Storage Buckets are available to Hugging Face users and organizations, and the official docs point readers to the Hugging Face storage page for pricing details. Treat that as an operational variable, especially for video-heavy robotics datasets.

Use a few guardrails before connecting this pattern to a real robot workflow:

- Keep secrets out of manifests, logs, bucket paths, and examples.
- Use buckets for mutable working artifacts, not reviewed releases that need history.
- Keep curated datasets and models in normal Hub repositories with cards and version history.
- Prefer `hf buckets sync --dry-run` or `--plan` before writing to shared bucket paths.
- Add lifecycle rules or manual cleanup for large failed runs, especially if camera data is involved.
- Make agents validate manifests before they consume checkpoints or logs.

The operational mistake to avoid is treating object storage as a source of truth without checksums, ownership, and cleanup conventions.

## What we'd watch next

The next useful step is tighter agent control around robot learning loops. A Strands or local agent workflow could record an episode, validate it, train a small policy, inspect the log, and then prepare a bucket sync plan for human review.

Robotics tooling is moving toward standard interfaces, shared datasets, and agent-assisted operations. That makes the unglamorous parts more important. Folder layout, manifests, dry-runs, and cost controls are what keep a good demo from turning into an unmanageable pile of files.

## References

- [Hugging Face Blog](https://huggingface.co/blog)
- [Hugging Face LeRobot repository](https://github.com/huggingface/lerobot)
- [Hugging Face Storage Buckets documentation](https://huggingface.co/docs/hub/en/storage-buckets)
- [Strands Agents SDK repository](https://github.com/strands-agents/harness-sdk)
- [A2Techify sample repo: LeRobot Bucket Manifest Lab](https://github.com/A2Techify-LLC/lerobot-bucket-manifest-lab)
