---
layout: post
title: "Dynamic Workers Make Agent Sandboxes Cheaper To Throw Away"
date: 2026-09-28 07:30:00 -0500
categories: [ai, engineering]
tags: [cloudflare, agents, security, infrastructure, devtools]
description: "Cloudflare Dynamic Workers move agent code execution into short-lived isolates, which is a practical shape for sandboxing generated JavaScript with narrow capabilities."
image: "/assets/images/posts/cloudflare-dynamic-workers-agent-sandboxes.png"
---

Cloudflare's Dynamic Workers are worth a closer look because they change the economics of running code that an agent generated. Instead of starting a container, warming a pool, or reusing a long-lived sandbox, a Worker can load another Worker at runtime with the exact code and bindings needed for that task.

That matters for agent systems because generated code should be disposable. If every run gets a fresh isolate with only the APIs it needs, the sandbox becomes part of the product design instead of an expensive cleanup chore.

<!--more-->

## What Changed

Cloudflare describes Dynamic Workers as a way to spin up isolated Workers on demand to execute code supplied at runtime. The lower-level API lets the caller define the module code, compatibility date, bindings, outbound network behavior, and resource limits for the loaded Worker.

The company positioned the feature as a lightweight alternative to containers for untrusted code and agent "Code Mode" workflows. In the announcement, Cloudflare says the Dynamic Worker Loader is in open beta for paid Workers users, runs on V8 isolates, and can start in a few milliseconds while using a few megabytes of memory.

The practical idea is simple: an agent can write JavaScript against a small TypeScript-shaped API, and the host Worker can execute that JavaScript in a separate Worker isolate rather than evaluating it inside the main application.

## Why We're Paying Attention

Most teams that experiment with agent-written code reach for containers because containers are familiar. They are also heavy enough that teams are tempted to keep them warm, reuse them, or grant broad access so the sandbox does not become operationally painful.

Dynamic Workers push toward a different default:

```text
One task.
One generated module.
One narrow set of bindings.
One short-lived sandbox.
```

That is the right mental model for generated code. The agent does not need the application process, the deployment environment, or the account's general credentials. It needs a small capability surface: maybe a read-only search function, a document writer, a queue producer, or a filtered fetch path.

The most useful part is that the host can pass capabilities as bindings or RPC stubs. That makes the permission boundary explicit in code review. The question becomes "what bindings did we hand the generated code?" instead of "what could this process reach from inside a reused runtime?"

## How It Works

The basic loader shape is compact. The host Worker receives or creates generated code, loads it as a module, controls outbound access, then calls the exported entrypoint.

```js
const agentCode = `
  export default {
    async summarize(input, env) {
      const notes = await env.NOTES.search(input.topic);
      return notes.map((note) => note.title).slice(0, 5);
    }
  }
`;

const worker = env.LOADER.load({
  compatibilityDate: "2026-03-01",
  mainModule: "agent.js",
  modules: { "agent.js": agentCode },
  env: {
    NOTES: notesSearchRpcStub,
  },
  globalOutbound: null,
});

const result = await worker.getEntrypoint().summarize({ topic: "rlhf notes" });
```

That example intentionally blocks general internet access with `globalOutbound: null`. If the generated code needs HTTP, Cloudflare says the host can route outbound requests through a callback or fetcher where it can inspect, rewrite, block, or enrich the request.

For agent systems, the cleaner pattern is usually to avoid broad HTTP and expose a typed wrapper instead. A small RPC surface such as `searchNotes(query)`, `appendDraft(id, text)`, or `createTicket(summary)` is easier to reason about than a proxy that has to understand every possible URL, method, header, and body an agent might produce.

## A Small Useful Test

This post does not need a sample repo. The useful test is a design review that any team building agent execution can run before adopting a sandbox runtime.

Take one agent workflow and write down the capability list before thinking about implementation:

```text
Workflow: summarize recent customer feedback

Generated code can:
- read normalized feedback records
- call one summarization helper
- write a draft summary to a review queue

Generated code cannot:
- read raw credentials
- call arbitrary internet URLs
- update production customer records
- access the operator's filesystem
- persist state outside the approved draft queue
```

If that list is hard to write, the workflow is probably not ready for generated code execution. If the list is short and stable, Dynamic Workers become interesting because the host can express those capabilities directly through bindings and outbound controls.

## Cost And Operational Notes

Dynamic Workers are not a free replacement for every sandbox. Cloudflare's current docs and announcement point to paid Workers availability, and the runtime is centered on Workers' JavaScript-first model. If the generated code needs Linux packages, long-running shell processes, browsers, or arbitrary language runtimes, a container or full sandbox is still the better fit.

Security also needs a sober read. Isolates are designed for fast, dense multi-tenant execution, but isolate sandboxing has a different risk profile than hardware virtualization. Cloudflare points to defense-in-depth around the Workers platform, V8 patching, second-layer sandboxing, and outbound controls. Teams should still treat generated code as hostile and keep the capability surface small.

The biggest operational win is avoiding sandbox reuse. If startup is measured in milliseconds and memory in megabytes, it becomes realistic to throw away the execution environment after each run. That removes a class of cleanup and cross-task contamination problems that show up when sandboxes are expensive.

## What We'd Watch Next

The next question is portability. Dynamic Workers are a strong fit for teams already building on Cloudflare Workers, but agent platforms will need clear abstractions for code execution across local dev, CI, edge runtime, and heavier sandboxes.

The pattern is the durable lesson: generated code should run behind a narrow, typed capability boundary; outbound access should be explicit; credentials should stay outside the generated code; and the runtime should be cheap enough to discard after each task.

For small teams, that is the bar to use when judging any agent sandbox. If the sandbox makes the least-privilege path cheap, it deserves attention.

## References

- [Cloudflare Blog: Sandboxing AI agents, 100x faster](https://blog.cloudflare.com/dynamic-workers/)
- [Cloudflare Docs: Dynamic Workers](https://developers.cloudflare.com/dynamic-workers/)
- [Cloudflare Docs: Workers RPC](https://developers.cloudflare.com/workers/runtime-apis/rpc/)
- [Cloudflare Docs: How Workers works](https://developers.cloudflare.com/workers/reference/how-workers-works/)
