---
layout: post
title: "Cloudflare OAuth Makes Agent Permissions Less All-Or-Nothing"
date: 2026-08-21 07:30:00 -0500
categories: [security, engineering]
tags: [agents, cloudflare, security, mcp]
description: "Cloudflare's optional OAuth scopes give agent and MCP builders a practical way to request broad capability while letting users approve a narrower task-based grant."
image: "/assets/images/posts/cloudflare-oauth-optional-scopes-agent-consent.png"
---

Cloudflare added OAuth scope customization for third-party OAuth apps. Client owners can now mark some configured scopes as optional, and users can deselect those optional scopes during consent.

That sounds like a small consent-screen feature. For agents, MCP servers, CLIs, and internal automation tools, it is more important than that. It gives builders a cleaner way to separate "this app can support this capability" from "this exact task needs this permission right now."

<!--more-->

## What Changed

Cloudflare OAuth already allowed an app to request a subset of the scopes configured on the OAuth client. The missing piece was user-side narrowing at authorization time. If the app requested more access than the user wanted to grant, the user had to approve everything or deny the request.

With the new scope customization, Cloudflare says developers can:

- mark specific OAuth client scopes as required or optional;
- let users deselect optional scopes during authorization;
- receive an access token that contains only the scopes the user actually approved;
- keep existing OAuth client behavior unchanged when no optional scopes are configured.

Cloudflare calls out MCP servers directly. An MCP server may support many tools, but a user may only want an agent to use a narrow slice of them for a specific job. Optional scopes make that consent less brittle.

## Why We're Paying Attention

Agent permissions are easy to over-grant. A tool server may expose read, write, deploy, billing, storage, and account metadata actions because the agent could theoretically use all of them. The actual workflow might only need read access to one zone or write access to one Worker.

Before task-based consent, developers had three awkward choices:

- request broad scopes and ask users to trust the app;
- build a custom pre-consent scope picker;
- create many narrowly scoped app variants that are harder to maintain.

Cloudflare's change does not remove the need for careful scope design. It does give teams a platform-level place to express which scopes are essential for a flow and which ones are nice to have.

For small teams, that matters. The easiest secure system to operate is the one where fewer exceptions live in spreadsheets, support tickets, and "remember not to click that" instructions.

## How It Works

The OAuth client still has a configured scope list. The new field is `optional_scopes`, which names the configured scopes a user may decline during consent.

Cloudflare's example uses a client configured with four scopes:

```json
{
  "scopes": [
    "user-details.read",
    "workers-scripts.write",
    "workers-kv-storage.write",
    "zone.read"
  ],
  "optional_scopes": [
    "workers-kv-storage.write",
    "zone.read"
  ]
}
```

If an authorization request asks for all four scopes, the user can opt out of `workers-kv-storage.write` and `zone.read`. The required scopes remain required only because they were included in that authorization request.

The subtle detail is important: Cloudflare evaluates required and optional scopes against the scopes requested in the current authorization flow, not every scope configured on the client. If a later flow requests only `workers-scripts.write` and `zone.read`, then only those two scopes are shown and evaluated.

That keeps the consent screen tied to the task instead of turning it into a full inventory of everything the app could ever do.

## A Small Useful Test

This post does not need a sample repo. The useful example is the handling logic every OAuth-backed agent tool should have after exchanging the authorization code.

Do not assume the token has every scope you requested. Treat the granted scope set as runtime input:

```js
const requiredScopes = new Set(["workers-scripts.write"]);
const optionalFeatures = {
  "workers-kv-storage.write": "kvWrites",
  "zone.read": "zoneInspection"
};

function planCapabilities(grantedScopeString) {
  const granted = new Set(grantedScopeString.split(/\s+/).filter(Boolean));

  for (const scope of requiredScopes) {
    if (!granted.has(scope)) {
      throw new Error(`Missing required OAuth scope: ${scope}`);
    }
  }

  return Object.fromEntries(
    Object.entries(optionalFeatures).map(([scope, capability]) => [
      capability,
      granted.has(scope)
    ])
  );
}
```

The agent should then degrade cleanly. If the user declined KV write access, the agent can still inspect or edit scripts if those scopes were granted, but it should not route around the missing permission by asking for a long-lived API token.

## Cost And Operational Notes

Cloudflare's OAuth applications documentation lists OAuth availability across Free, Pro, Business, and Enterprise plans. That makes this pattern reasonable to test without creating a paid dependency just for the consent model.

The operational work is still on the app owner:

- request the narrowest scopes that fit the task;
- mark convenience or follow-on capabilities optional;
- check the granted scopes after token exchange;
- hide, disable, or explain unavailable agent tools when optional scopes are declined;
- log authorization failures without storing tokens or sensitive account data;
- avoid falling back to broader API tokens when OAuth consent was intentionally narrowed.

Optional scopes are not a substitute for authorization inside the tool server. They are a front-door control that should line up with server-side enforcement.

## What We'd Watch Next

The next useful step is better agent UX around partial grants. Users should not have to understand every provider-specific scope name to make a good decision. The app can ask for the right OAuth scopes, but the agent interface should explain missing capabilities in task language: "I can update the Worker, but I cannot write KV values because that permission was not granted."

The same pattern applies outside Cloudflare. Any agent platform that connects to infrastructure, databases, SaaS APIs, or internal admin systems should be designed around partial grants from the beginning. The happy path is not "approve everything." The happy path is "approve exactly enough, then let the software behave predictably."

## References

- [Cloudflare Blog: From all-or-nothing to task-based OAuth consent](https://blog.cloudflare.com/task-based-oauth-consent/)
- [Cloudflare Docs: OAuth Applications on Cloudflare](https://developers.cloudflare.com/fundamentals/oauth/)
- [Cloudflare Blog: Third-party OAuth apps on Cloudflare](https://blog.cloudflare.com/oauth-for-all/)
