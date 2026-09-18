---
layout: post
title: "AI Agent Benchmarks Need a Consistency Number"
date: 2026-09-18 07:30:00 -0500
categories: [ai, engineering]
tags: [agents, devtools, infrastructure]
description: "IBM's ALTK-Evolve team showed why average pass rates can hide unstable agent behavior, and how Pass^k gives builders a better reliability check."
image: "/assets/images/posts/ai-agent-consistency-gap.png"
---

IBM's ALTK-Evolve team published a useful reminder for anyone shipping agents: an agent can look strong on average and still be unreliable when the same task is repeated.

The concrete number is the hook. On AppWorld, a ReAct agent using GPT-4.1 reached 77.4% average success across five runs, but only succeeded on all five attempts for 53.0% of tasks. That 24.4-point gap is the part a normal benchmark headline would hide.

<!--more-->

## What Changed

The new work introduces a consistency-focused evaluation and mitigation path for ALTK-Evolve. Instead of only reporting Mean@k, the team argues for tracking Pass^k: the percentage of tasks where every one of k repeated runs succeeds.

That is different from Pass@k. Pass@k asks whether at least one attempt worked, which is useful when a system can retry and verify the answer. Pass^k asks whether the workflow is repeatable without needing luck, retry budget, or a human watching the output.

The team also describes a Consistency Analyzer that looks at an agent's recorded trajectory and resamples decision points to find where the next action is likely to flip. Those unstable steps can then be turned into targeted guidelines and fed back through ALTK-Evolve's memory system.

## Why We're Paying Attention

Agent reliability problems often show up after the demo. A workflow reconciles an invoice once, then chooses a different lookup path the next time. A coding agent fixes a test in rehearsal, then edits the wrong file in a similar production run. A support agent can use the right API, but sometimes skips the verification step.

Averages flatten those failures. If one task passes three times and fails twice, Mean@5 may still make the agent look capable. For operators, the question is harsher: will this same task work every time we hand it to automation?

Pass^k is a simple way to put that question on the dashboard. It does not replace average accuracy, but it catches a different failure mode: variance in the agent's own decision path.

## How It Works

The ALTK-Evolve post frames the problem as unstable decision points. Even at temperature zero, hosted inference can have tiny numerical differences from batching, hardware, and platform behavior. When the model's next-token distribution has a clear winner, those differences do not matter much. When several options are nearly tied, a small nudge can send the agent down a different branch.

That matters more for agents than for one-shot completions because an agent trajectory chains many decisions together:

```text
task -> search -> choose tool -> pass arguments -> inspect result -> retry or continue -> final answer
```

One weak branch point can change the whole run. Several weak branch points compound.

The Consistency Analyzer works from a recorded trace rather than rerunning the full task end to end. For each decision step, it asks for multiple completions against the same context and scores how much the output varies. The flagged steps become candidates for reusable guidance, such as preferring a line-anchored regex when counting checkbox markers or verifying that a search result is the intended note before using it.

In the reported AppWorld evaluation, consistency guidelines raised same-task Pass^5 from 53.0% to 69.0%, while Mean@5 rose from 77.4% to 81.0%. The arXiv abstract reports +16 points on same-task evaluation and +13 points on similar-task generalization.

## A Small Useful Test

This post does not need a sample repo. The useful artifact is an evaluation habit you can add to any agent workflow that already has a test harness.

Pick a small set of realistic tasks and run each one multiple times with the same inputs:

```text
for each task:
  run the agent 5 times
  record pass/fail for each run
  report Mean@5 = average pass rate across runs
  report Pass^5 = task counts only if all 5 runs pass
  inspect tasks where Mean@5 passed but Pass^5 failed
```

Those inconsistent tasks are the ones to review first. Look for branch points where the agent changed tools, changed filters, skipped validation, interpreted ambiguous text differently, or made a data transformation without checking the result.

For production-like agents, keep the task set small enough that it runs often. Ten representative tasks repeated five times can teach more about operational reliability than a larger benchmark that only reports one pass rate.

## Cost And Operational Notes

The cost is mostly evaluation budget. Repeating tasks five times is more expensive than a single run, and full end-to-end repeats may touch external systems. Use fixtures, read-only sandboxes, local mocks, or replayable environments where possible.

The analyzer described by IBM is cheaper than full repeated rollout because it works from a recorded trajectory and resamples decision points offline. That still uses model calls, but it avoids redoing tool actions or environment interactions for every diagnostic pass.

There are a few practical limits to keep in mind:

- Pass^k gets stricter as k grows, so compare the same k over time.
- A low Pass^k does not tell you whether the model is incapable or the workflow is under-specified; you still need trace review.
- Fixed seeds and temperature zero do not fully remove variance on hosted systems.
- Guidelines should be tested for average accuracy as well as consistency, so reliability work does not just move failures around.

For small teams, the starting point is not a new platform. Add repeated-run reporting to the workflows you already trust enough to benchmark.

## What We'd Watch Next

The useful next step is broader tooling support. Agent frameworks should make repeated-run evaluation and Pass^k reporting boring, especially for tool-using workflows where the same task can be replayed against fixtures.

We would also watch how well consistency guidelines transfer outside AppWorld-style tasks. The idea is promising because it targets a real production problem, but teams should prove it on their own workflows before treating it as a general reliability fix.

The takeaway is simple: stop asking only whether an agent can solve the task. Ask whether it can solve the task again.

## References

- [Hugging Face Blog: Your Agent Aced the Task. Will It Do It Again?](https://huggingface.co/blog/ibm-research/altk-evolve-consistency)
- [arXiv: Closing the Consistency Gap: Self-Evolving Agents That Learn to Stay on Course](https://arxiv.org/abs/2609.08832)
- [GitHub: AgentToolkit/altk-evolve](https://github.com/AgentToolkit/altk-evolve)
