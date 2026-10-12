---
layout: post
title: "Protected Quick Tunnels Make Agent Previews Less Risky"
date: 2026-10-09 07:30:00 -0500
categories: [engineering, infrastructure]
tags: [cloudflare, agents, devtools, security]
description: "Cloudflare added free email protection to accountless Quick Tunnels, giving local agent previews a lightweight access gate without creating a Cloudflare app."
image: "/assets/images/posts/cloudflare-protected-quick-tunnels-agent-previews.png"
---

Cloudflare added a practical guardrail to one of the easiest ways to put a local service on the internet: Quick Tunnels can now require email authentication with `--allowed-mail`, while staying accountless and free.

That is useful because agents have made throwaway preview URLs more common. A local coding agent builds a page, starts a dev server, runs `cloudflared tunnel`, and hands back a URL. The speed is excellent. The risk is that the URL is public unless the developer adds a separate access layer. Protected Quick Tunnels narrow that gap for browser-based demos, review links, and short-lived local tools.

<!--more-->

## What Changed

Quick Tunnels already let a developer expose a local port without a Cloudflare account, a DNS record, or a named tunnel. Cloudflare's new option adds an email allow list:

```bash
cloudflared tunnel --url http://localhost:8080 --allowed-mail you@example.com
```

Visitors who open the generated URL see a Cloudflare Access email sign-in flow and receive a one-time PIN. If the email matches the allow list, the request reaches the local service. If it does not, the local app never sees the request.

Cloudflare says public Quick Tunnels are unchanged. The protected mode is an extra flag for short-lived previews that need a simple human access check.

## Why We're Paying Attention

This fits a pattern small teams are running into more often: local agent work wants to become visible quickly.

```text
agent builds local app -> dev server starts -> tunnel URL is generated -> human reviews it
```

That workflow is convenient for demos, bug reproduction, MCP servers, webhook tests, and quick mobile checks. It is also easy to overshare. A random tunnel hostname is not access control, and development servers often expose logs, debug routes, fixture data, or admin-only flows that were never meant to be browsed by the public internet.

Protected Quick Tunnels do not turn a dev server into production infrastructure. They do give the preview link a sane default boundary: only the selected email addresses or domains can open it in a browser.

## How It Works

The design is more interesting than the command. Cloudflare kept the tunnel accountless, but reused Cloudflare Access for the hard part of email authentication.

The flow Cloudflare describes looks like this:

1. `cloudflared` starts the tunnel and tells Cloudflare that email authentication is required.
2. A visitor without a session is redirected to Cloudflare Access.
3. Access verifies control of the email address with a one-time PIN.
4. A small authentication broker creates a short-lived signed handoff tied to the tunnel hostname.
5. `cloudflared` checks the handoff locally against the allow rules supplied on the command line.
6. Matching visitors get a local session for up to four hours, or until the tunnel process stops.

The important privacy detail is that the allow list stays on the developer's machine. Cloudflare says it learns that a tunnel requires email authentication, but not who was invited. `cloudflared` also strips authentication credentials before forwarding the request, so the local app does not need to implement a login flow and does not receive the Access identity payload.

## A Small Useful Test

This post does not need a sample repo. The useful test is one command against any local development server.

Start a server locally:

```bash
python3 -m http.server 8080
```

Then expose it with one allowed address:

```bash
cloudflared tunnel --url http://localhost:8080 --allowed-mail you@example.com
```

Open the generated URL in a browser session that is not already signed in. You should see the email PIN flow before the local directory listing or app appears. Stop `cloudflared`, then reload the URL. Access should end with the tunnel process.

For a team test, use a domain rule only if that is really the intended audience:

```bash
cloudflared tunnel --url http://localhost:8080 --allowed-mail '*@example.com'
```

That is handy for internal reviews, but it is broader than a single reviewer. Treat it like any other access policy.

## Cost And Operational Notes

The cost story is friendly: Cloudflare says email protection for Quick Tunnels is free, like Quick Tunnels themselves. There is no paid API key or billing-enabled service needed for the basic workflow.

The operational boundary matters more:

- Quick Tunnels are for testing and development, not production traffic.
- The hostname changes each time a new tunnel starts.
- There is no uptime guarantee.
- Cloudflare's docs list a limit of 200 in-flight requests; additional requests return `429`.
- Quick Tunnels do not support Server-Sent Events.
- Email authentication requires an interactive browser session, so it is not for non-interactive clients or machine-to-machine callbacks.
- For stable hostnames, richer identity provider rules, or production access, use a named Cloudflare Tunnel with Cloudflare Access instead.

That last point is the main decision rule. Protected Quick Tunnels are excellent for a short human preview. They are the wrong place to build a durable API surface.

## What We'd Watch Next

The interesting part is how this changes agent defaults. A coding agent that can already start a local server and parse a tunnel URL can also learn when a protected tunnel is the safer handoff.

For small teams, the practical policy is simple: public tunnel for harmless throwaway content, protected tunnel for anything that looks like a real app, and named tunnel plus Access when the endpoint needs to live beyond the current session.

This is not a replacement for secrets hygiene, fixture discipline, or production auth. It is a useful speed bump at the moment local work becomes shareable. That is exactly where many agent workflows need a better default.

## References

- [Cloudflare Blog: Protected Quick Tunnels: simple accountless authentication for your next dev project](https://blog.cloudflare.com/protected-quick-tunnels/)
- [Cloudflare Docs: Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
- [Cloudflare Docs: Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Cloudflare Docs: Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
