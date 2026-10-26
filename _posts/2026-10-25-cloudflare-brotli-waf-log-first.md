---
layout: post
title: "Cloudflare's Brotli WAF Rules Start in Log Mode for a Reason"
date: 2026-10-25 23:49:00 -0500
categories: [security, engineering]
tags: [cloudflare, security, infrastructure]
description: "Cloudflare added emergency WAF detections for Brotli request bodies and the Next.js image endpoint, but operators should audit inherited overrides before changing either rule from Log to Block."
image: "/assets/images/posts/cloudflare-brotli-waf-log-first.png"
---

Cloudflare added two emergency detections to its Managed Ruleset for CVE-2026-111497. One matches request bodies that declare `Content-Encoding: br`; the other matches requests to the Next.js image optimizer at `/_next/image`.

Both rules are enabled by default, but their default action is **Log**. That is the important operational detail. These match conditions also describe legitimate traffic, so seeing a match is not the same thing as seeing an exploit.

<!--more-->

## What Changed

Cloudflare's October 25 emergency WAF release adds:

- a Brotli rule that matches incoming requests declaring `Content-Encoding: br`; and
- a Next.js rule that matches the framework's `/_next/image` endpoint.

The Brotli rule is about request-body encoding. It does **not** match `Accept-Encoding: br`, and it does not change Cloudflare's Brotli response compression. A browser asking for a Brotli-compressed response is therefore not enough to trigger this detection.

The Next.js rule covers the image optimization path, including normal image requests. Blocking every match can break images on an otherwise healthy application.

Cloudflare ships both rules enabled in Log mode so teams can measure their own traffic before choosing a stronger action.

## The Override Trap

The defaults are only defaults. Cloudflare allows actions to be overridden at the ruleset, tag, and individual-rule levels. A broad ruleset-level override set to Block can apply to newly introduced rules even when those rules ship with Log as their default.

That creates two possible surprises:

```text
new managed rule
      |
      +-- no broader action override --> Cloudflare default: Log
      |
      +-- inherited Block override ----> effective action: Block
                                             |
                                             +-- Brotli API clients may fail
                                             +-- Next.js images may stop loading
```

Cloudflare explicitly tells customers to review existing action overrides before deployment. This is not just a tuning suggestion. It is the difference between collecting evidence and changing production behavior.

## A Practical Check Before Blocking

This release does not need a sample repository. The useful work happens against a team's real WAF configuration, analytics, and traffic; a wrapper project would not reproduce those conditions.

Start with a configuration audit:

1. Open the Cloudflare Managed Ruleset for each relevant zone.
2. Check whether the whole ruleset has an action override such as Block or Challenge.
3. Check tag-level overrides that could include these rules.
4. Find the two new CVE-2026-111497 rules and confirm their **effective** action, not only the displayed default.
5. Add rule-specific Log overrides if a broader policy would otherwise block them.

Then inspect matches separately:

- For the Brotli rule, identify request paths, methods, source systems, content types, response codes, and whether the application intentionally accepts compressed request bodies.
- For the Next.js rule, separate normal `/_next/image` requests from unexpected methods, query patterns, request bodies, or source behavior.
- Compare match volume with application errors and origin logs. A WAF match without application context is weak evidence.

If the application is behind a load test or synthetic monitor, include that traffic in the review. Automated clients often use request shapes that ordinary browser testing misses.

## A Small Staging Test

Use a staging hostname with the same relevant WAF policy. First exercise a normal optimized image URL:

```bash
curl --fail-with-body --show-error --location \
  'https://staging.example.com/_next/image?url=%2Flogo.png&w=640&q=75' \
  --output /dev/null
```

Then send a known-safe Brotli-compressed request to a staging endpoint designed to accept a body. The example uses the local `brotli` command and contains no secret:

```bash
printf '{"probe":"waf-log-test"}' > /tmp/waf-probe.json
brotli --force /tmp/waf-probe.json --output /tmp/waf-probe.json.br

curl --fail-with-body --show-error \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Content-Encoding: br' \
  --data-binary @/tmp/waf-probe.json.br \
  'https://staging.example.com/waf-probe'
```

Do not point this at a production endpoint that was not built to accept compressed bodies. The goal is to confirm the WAF event, effective action, and application behavior in a controlled path—not to simulate an exploit.

For each request, record:

```text
request reached edge -> rule matched -> effective action -> origin reached -> response expected
```

If any link in that chain is unknown, keep the rule in Log mode while you improve observability.

## When Block Can Make Sense

Blocking can be reasonable after the traffic review, but the decision should be scoped.

For the Brotli rule, an application that never accepts compressed request bodies has a clearer case for blocking `Content-Encoding: br`. Confirm that mobile clients, SDKs, webhook senders, and internal APIs do not use it first.

For the Next.js rule, a blanket Block action is usually a poor fit for an application actively using image optimization. Teams should avoid turning a path-level signal into an outage. If stronger protection is needed, test Cloudflare's current managed-rule behavior and scope changes around known application traffic rather than assuming every `/_next/image` request is hostile.

Also remember that a WAF rule is a compensating control, not a substitute for applying vendor fixes once affected components and patched versions are confirmed. Cloudflare's release note explains the detections and actions, but it does not provide enough detail to infer every affected software version or exploitation condition. Use the relevant software advisory as the source of truth for patching.

## Cost And Operational Notes

This is an update to the Cloudflare Managed Ruleset. Availability depends on the WAF rules and plan already enabled for the zone; the release note does not announce a separate product or price.

The larger cost is operational:

- **Log volume:** high-traffic Next.js sites may produce many matches for a legitimate endpoint.
- **False positives:** both conditions can match valid requests by design.
- **Override drift:** broad overrides can silently change the action of future managed rules.
- **Testing coverage:** production clients may encode requests differently from browser-based smoke tests.
- **Response ownership:** someone needs to review matches and decide when evidence supports blocking.

Treat inherited managed-rule overrides like code. Document why they exist, review how they affect new rules, and prefer rule-specific changes when a global action is too blunt.

## What We'd Watch Next

We would watch for a detailed upstream advisory that maps CVE-2026-111497 to affected and fixed versions. That determines the patch plan; the WAF release determines only one layer of immediate visibility and mitigation.

We would also watch match quality over the first few days. If normal Brotli API traffic or image optimization dominates the events, teams need narrower controls rather than a blanket switch to Block.

The immediate action is simple: check the **effective** action of both new rules now. Keep them in Log mode long enough to understand real traffic, add explicit rule-level overrides where broad policy creates accidental blocking, and move to enforcement only with staging evidence and a rollback path.

## References

- [Cloudflare changelog: Emergency Managed Ruleset release for CVE-2026-111497](https://developers.cloudflare.com/changelog/post/2026-10-25-emergency-waf-release/)
- [Cloudflare Docs: Cloudflare Managed Ruleset](https://developers.cloudflare.com/waf/managed-rules/reference/cloudflare-managed-ruleset/)
- [CVE record: CVE-2026-111497](https://www.cve.org/CVERecord?id=CVE-2026-111497)

