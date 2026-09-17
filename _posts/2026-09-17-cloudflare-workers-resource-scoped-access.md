---
layout: post
title: "Cloudflare Workers Access Can Now Be Scoped Per App"
date: 2026-09-17 07:30:00 -0500
categories: [security, infrastructure]
tags: [cloudflare, security, infrastructure, agents]
description: "Cloudflare added resource-level roles for Workers, giving teams a cleaner way to give CI systems, teammates, and coding agents only the access one application needs."
image: "/assets/images/posts/cloudflare-workers-resource-scoped-access.png"
---

Cloudflare added resource-level authorization for Workers. A teammate, CI job, or agent can now be given access to one specific Worker instead of every Worker in the account.

That sounds like account administration, but it is really an agent safety feature. If a deployment token leaks or an automation loop goes wrong, the blast radius can be one application instead of the whole Developer Platform account.

<!--more-->

## What Changed

Cloudflare introduced four Developer Platform roles that can be applied at platform, product, or resource scope:

- Metadata Read-Only: settings, metrics, logs, and traces, without product content.
- Content Read-Only: product content such as Worker code, without write access.
- Editor: read and write content and settings, without creating or deleting resources.
- Admin: full control, including create and delete.

For Workers, the practical new part is resource scope. Instead of granting a token broad Workers permissions, a team can grant `Editor` to one Worker that a pipeline deploys. Cloudflare says the same model is planned for more Developer Platform resources, including D1, R2, and KV.

## Why We're Paying Attention

Small teams tend to collect powerful tokens because narrow access was inconvenient. A shared CI token deploys several Workers. A debugging account can read more code than it needs. An agent gets a broad API token because the exact minimum permissions were unclear during setup.

Resource-scoped Workers access gives operators a better default. A production deploy token can update the one Worker it owns, while losing the ability to delete it or touch unrelated Workers. A debugging agent can tail logs and inspect traces without seeing source code. A review tool can read one Worker without gaining deploy rights.

That is the kind of boring control that makes automation easier to trust.

## How It Works

Cloudflare's docs describe permission policies as a role plus a scope. The scope can cover the whole Developer Platform, one product such as Workers, or one resource such as an individual Worker.

For API tokens, the useful pattern is per-workload tokens:

```text
CI token for api-worker
  scope: individual Worker -> api-worker
  role: Editor
  can: deploy existing code and update settings for api-worker
  cannot: delete api-worker, create new Workers, or change other Workers
```

Wrangler can use those granular permissions when authenticated with an account-owned API token. Cloudflare notes that `wrangler login` OAuth does not currently support granular authorization, so automated deployments should use a scoped token rather than a broad interactive login.

Routes and custom domains are a separate boundary. If a deployment changes how traffic reaches the Worker, Cloudflare requires Worker `Editor` access plus `Workers Routes Write` for the affected zone. Once the route is already configured, a narrowly scoped deployment token can keep shipping code without owning the domain.

## A Small Useful Test

This post does not need a sample repo. The useful test is an access inventory for every Worker-backed application.

Start with a table like this:

```text
Worker              actor                 current access        target access
api-production      GitHub Actions         Workers CI Edit       Worker Editor
api-production      on-call agent          account read token    Metadata Read-Only
admin-dashboard     review bot             Workers Scripts Read  Content Read-Only
marketing-edge      contractor             Workers Platform Admin Worker Editor, temporary
```

Then check each actor against the job it actually performs:

```text
Needs logs only?                 Metadata Read-Only
Needs source review only?         Content Read-Only
Needs to deploy an existing app?  Editor scoped to that Worker
Needs to create or delete apps?   Admin, preferably at product scope and rarely in CI
Needs route changes?              Add Workers Routes Write for the specific zone
```

The goal is not to create a different token for every command. The goal is to remove broad, reusable credentials from places where automation only works on one app.

## Cost And Operational Notes

Cloudflare says Worker-level access controls are available for all customers. The operational cost is migration work: inventory tokens, replace legacy Workers permissions with the new roles, and update runbooks so people know which role to request.

There are a few sharp edges to plan around:

- API tokens support product-level permissions and resource-level permissions where available, but not platform-level permissions.
- Creating a new Worker requires `Admin` at the Workers product scope; deploying an existing Worker can use `Editor` scoped to that Worker.
- Deployments that change routes or custom domains need separate zone-level route permission.
- Durable Objects inherit access from the Worker that implements them; Durable Objects Data Studio requires `Editor` because it can query and modify stored data directly.
- Legacy Workers roles still work, but Cloudflare recommends moving to the new roles for granular resource-level access.

For agent workflows, the cleanest rollout is to start with observability and deployment tokens. Give agents `Metadata Read-Only` when they only need logs and traces. Give CI `Editor` for a single existing Worker. Keep `Admin` out of routine automation unless the job genuinely creates or deletes resources.

## What We'd Watch Next

The next important step is whether this model lands cleanly across D1, R2, KV, Queues, Vectorize, and Workers AI. Workers rarely live alone. A realistic app may deploy code, query a database, read a bucket, publish to a queue, and emit logs.

The model will be strongest when each of those resources can be scoped to the same application boundary. That would let a small team hand an agent a narrow operational role without handing it the whole account.

For now, the useful move is simple: stop treating Workers deployment credentials as account-wide keys. Give each app, pipeline, and agent the smallest role that lets it do its job.

## References

- [Cloudflare Blog: Give every teammate and agent the right level of access to your Workers](https://blog.cloudflare.com/workers-granular-authorization/)
- [Cloudflare Workers Docs: Roles and permissions](https://developers.cloudflare.com/workers/authorization/)
- [Cloudflare Docs: Roles](https://developers.cloudflare.com/fundamentals/manage-members/roles/)
