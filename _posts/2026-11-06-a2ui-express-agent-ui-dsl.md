---
layout: post
title: "A2UI Express Moves Agent UI Generation Out of JSON"
date: 2026-11-06 10:19:00 -0600
categories: [ai, engineering]
tags: [agents, devtools]
description: "A2UI Express gives agents a compact, schema-derived UI language, then compiles it into validated A2UI messages for existing renderers."
image: "/assets/images/posts/a2ui-express-agent-ui-dsl.png"
---

Google's A2UI project has added a useful separation to generative interfaces: the model no longer has to write the verbose JSON that the renderer consumes.

A2UI Express is a compact, line-oriented syntax generated from the same component catalog as the A2UI wire format. An agent writes Express; the Agent SDK compiles and validates it into standard A2UI messages. Existing renderers and catalogs do not need to change.

That is a practical pattern beyond UI generation: let the model produce a small language designed for inference, then let deterministic code produce the strict transport format.

<!--more-->

## What Changed

A2UI already limited agent-generated interfaces to a catalog of trusted components. The client advertises the components and properties it supports, the agent describes a surface using that contract, and a renderer draws it.

The original path asked the model to generate the JSON transport messages directly. That made every property name, brace, quote, and nested object part of the model's output budget. It also asked a probabilistic system to satisfy a relatively large schema without syntax mistakes.

The new Agent SDK path makes the model-facing format replaceable. A format supplies two pieces:

1. prompt instructions derived from the component catalog; and
2. a compiler that turns the model response into validated A2UI messages.

A2UI Express is the new compact option. Google's 51-task evaluation found that it used up to three times fewer tokens than direct JSON while preserving the same UI expressiveness. The project also supports custom inference formats, so the renderer contract is no longer tied to one model syntax.

## What The Model Writes

Express uses one assignment per line, positional arguments based on the catalog schema, and variable names that become component IDs. Data bindings and server events have short forms:

```text
surface("order-status")
$/title="Order shipped"
$/detail="Expected Tuesday"
root=Card(content)
content=Column([title, detail, actions], _, "start")
title=Text($/title, "headline")
detail=Text($/detail, "body")
actions=Row([track_button], "end")
track_label=Text("Track package")
track_button=Button(track_label, _, Event("track_order", {orderId: "ord_42"}))
```

The compiler maps positional arguments back to the property names declared by the catalog, resolves references such as `content` and `title`, and emits the normal A2UI payload. A model cannot introduce a component that the catalog does not expose simply by naming it in Express; compilation and schema validation remain the enforcement point.

This is not “Python that the agent gets to execute.” It is a declarative DSL with a parser and compiler. Treat the output as untrusted input even though it looks familiar.

## The Architecture Worth Copying

The strongest part of this release is the boundary between model output and application protocol:

```text
component catalog
      ├──> model instructions
      └──> Express compiler + validator

user request -> model -> A2UI Express -> validated A2UI JSON -> renderer
```

Both the prompt contract and compiler come from the same catalog. That reduces the chance that documentation tells the model one thing while runtime validation expects another.

It also creates three useful operational boundaries:

- **The model chooses composition.** It selects known components, bindings, and events.
- **Deterministic code owns translation.** IDs, property names, protocol versions, and payload shape are compiler work.
- **The renderer keeps authority.** The client still decides which components and actions exist and how they behave.

For agent systems, this is usually safer and cheaper than asking the model to reproduce a machine-oriented protocol exactly. The same shape can work for workflow plans, report definitions, policy suggestions, and tool-call batches: use a constrained intermediate representation, compile it, then validate the compiled artifact before execution.

## A Small Test Before Adopting It

This topic does not need another sample repository. The official SDK and specification already contain the implementation; a focused comparison in your own application will tell you more than a wrapper project.

Take 20 to 50 representative UI requests and run both formats against the same model, catalog, temperature, and output limits. Record:

- input and output token counts;
- time to first usable surface and total completion time;
- compiler or validation failures;
- missing or incorrect components;
- event and data-binding correctness; and
- retries needed to produce a valid result.

Then compare the compiled Express output with direct JSON semantically. Do not compare strings. Normalize the A2UI messages and check component types, IDs, properties, bindings, actions, and surface lifecycle operations.

For the Python SDK, the format choice is explicit:

```python
from a2ui.inference_formats import ExpressFormatFactory
from a2ui.processor import A2uiGenerator, CatalogConfig

catalog = CatalogConfig.from_path("catalog.json")
generator = A2uiGenerator(
    [catalog],
    examples=few_shot_examples,
    inference_format_factory=ExpressFormatFactory(),
)

processor = generator.create_processor(renderer_capabilities)
system_prompt = f"{instructions}\n\n{processor.prompt_snippet}"
parts = processor.parse_response(model_reply)
```

Keep the old path available during rollout. If Express compilation fails, capture the raw response and exact catalog version for diagnosis. A silent fallback that sends malformed or partially interpreted UI is worse than showing a plain-text response.

## Where The Savings Come From

JSON repeats information that is useful to a general parser but wasteful for a model that already has a component schema in context. Express removes repeated keys, much of the punctuation, and nested protocol envelopes. Positional arguments carry meaning through the catalog's declared order.

That can reduce both latency and cost because the model emits fewer tokens. It can also improve reliability by shrinking the number of structural decisions in each response.

There is a trade-off: positional syntax is less self-describing to a human reader and more sensitive to schema ordering. The catalog and generated prompt therefore become versioned production dependencies. Changing a component signature without coordinating the compiler, prompt, examples, and cached conversations can change how the same line is interpreted.

## Cost And Operational Notes

The A2UI project and SDK are open source, and trying Express does not require a paid API if it is paired with a local model. Your actual inference cost still depends on the selected model and provider.

Before shipping, account for:

- **Catalog versioning:** log the catalog ID or digest with every generation and compiled payload.
- **Compiler errors:** make failures observable by syntax, unknown component, invalid property, bad binding, and unsupported protocol version.
- **Security:** allowlist events and client functions; never map an agent-generated event name directly to arbitrary code or network access.
- **Examples:** regenerate or test few-shot examples when component signatures change.
- **Streaming behavior:** the October Python and TypeScript SDKs can stream direct JSON, while Express is compiled from the complete reply. Measure perceived latency in your real renderer instead of assuming fewer tokens automatically means earlier paint.
- **Rollback:** keep format selection configurable so a model or SDK regression does not require a renderer release.

Google also describes a faster controlled-generation path for screens whose layouts are known in advance: a decision model selects among predefined structures while a language model supplies text. That is a different trade-off. Use controlled layouts for settings, confirmation, and checkout screens with fixed archetypes; use Express when the agent needs the full catalog's compositional freedom.

## What We'd Watch Next

The immediate question is not whether Express is smaller than JSON. It is whether teams can evolve catalogs without creating subtle compatibility failures across prompts, compilers, models, and renderers.

We would watch for:

- stable catalog and protocol version negotiation;
- conformance tests shared across Python, TypeScript, and Dart SDKs;
- better incremental or streaming compilation for Express;
- eval results across small local models, not only hosted frontier models; and
- production guidance for logging model output without retaining sensitive UI data.

The broader lesson is already useful: a transport schema does not have to be the language an agent speaks. Keep the transport strict, give the model a smaller representation, and put deterministic compilation between generation and execution.

## References

- [Google Developers Blog: Fast, reliable A2UI, with swappable inference formats](https://developers.googleblog.com/en/fast-reliable-a2ui/)
- [A2UI Express technical specification](https://a2ui.org/specification/proposals/express/a2ui_express/)
- [A2UI project repository](https://github.com/a2ui-project/a2ui)
- [A2UI Python Agent SDK changelog](https://github.com/a2ui-project/a2ui/blob/main/python/a2ui_agent/CHANGELOG.md)

