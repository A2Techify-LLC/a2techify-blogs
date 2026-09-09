---
layout: post
title: "Cloudflare Automatic Key Exchange Makes Post-Quantum Origin TLS Less Manual"
date: 2026-09-09 07:30:00 -0500
categories: [security, infrastructure]
tags: [cloudflare, security, infrastructure]
description: "Cloudflare's Automatic Key Exchange measures each origin's TLS 1.3 key agreement support, then leads with the strongest safe key share, including X25519MLKEM768 where origins support it."
image: "/assets/images/posts/cloudflare-automatic-key-exchange-origins.png"
---

Cloudflare is rolling out Automatic Key Exchange for origin connections. The practical change is that Cloudflare no longer has to make the same first TLS 1.3 key-share guess for every origin. It probes origins, learns what they support, and then starts new HTTPS connections with the strongest safe key agreement it believes that origin can handle.

That sounds small until you look at the two problems it touches: extra handshake latency and post-quantum migration. Cloudflare says its static X25519-first strategy was suboptimal for roughly 30% of measured origin connections. With Automatic Key Exchange rolling out, HelloRetryRequests dropped from about 52% to 3.7%, cutting more than 150 ms from p90 connection handshake latency.

<!--more-->

## What Changed

Automatic Key Exchange is part of Cloudflare's origin-facing SSL/TLS stack. When Cloudflare opens a TLS 1.3 connection to an origin, it has to include a key share in the first `ClientHello`. If the origin accepts that choice, the handshake completes in one round trip. If the origin wants a different group, it sends a HelloRetryRequest and the client has to try again, adding a full round trip.

Historically, Cloudflare used X25519 as the first key share for origin connections. X25519 is widely supported, but it is not post-quantum safe, and it is not the fastest path for every origin. Some origins prefer P-256 or P-384. Some now support the standardized hybrid post-quantum group `X25519MLKEM768`.

The new system scans active origins out of band, builds a traffic-weighted preference for the zone, and then rolls that preference into production gradually. If the origin supports the hybrid post-quantum group and the zone's compliance settings allow it, Cloudflare prefers `X25519MLKEM768`. Otherwise it chooses a supported classical group.

Cloudflare says Automatic Key Exchange is on for existing zones and on by default for new zones. It applies to zones using Full, Full (strict), or Strict (SSL-Only Origin Pull) mode when the origin negotiates TLS 1.3 with Cloudflare. It does not apply to Cloudflare Tunnel, which has its own post-quantum path between `cloudflared` and Cloudflare.

## Why We're Paying Attention

Post-quantum migration is easy to describe and hard to operate. A team can say it wants stronger origin encryption, but the real production question is more specific: can every active origin, load balancer, middlebox, and TLS library on that path handle the larger hybrid key share without breaking traffic?

Cloudflare is treating that as an operations problem instead of a settings-page problem. It measures capability before putting real traffic behind a new preference, rolls the change out through small percentages, watches failure and retry rates, and rolls back unhealthy changes.

That pattern matters beyond TLS. A lot of infrastructure hardening fails because it asks every small team to become an expert in the underlying protocol before they can safely adopt the safer default. Automatic Key Exchange is a useful example of the opposite approach: discover, stage, monitor, and keep rescanning as the environment changes.

## How It Works

The scan is intentionally narrow. Cloudflare's documentation says it checks active origins about every 24 hours and tests the TLS key agreements each origin supports and prefers. The blog describes probes for X25519, P-256, P-384, P-521, and `X25519MLKEM768`.

After the scan, Cloudflare chooses the strongest allowed option. The rollout path starts at 1% of traffic, then moves through 10%, 25%, 50%, 75%, and 100% if the connection failure and HelloRetryRequest rates stay healthy. If the change looks unhealthy, Cloudflare rolls back to the previous setting.

The important safety detail is that Cloudflare still advertises other allowed key agreements. If an origin needs another advertised group, it can use a HelloRetryRequest. That adds latency, but it should not break the connection by itself.

Cloudflare also added compliance requirements that can restrict what it may negotiate for TLS 1.3 origin connections. The choices include post-quantum hybrid only and FIPS-only modes. Those are policy controls, not magic compatibility switches. If a team forces post-quantum hybrid on an origin that does not support `X25519MLKEM768`, there may be no mutually supported algorithm for TLS 1.3.

## A Small Useful Test

This post does not need a sample repo. The useful work is checking an actual origin and deciding whether policy enforcement is safe.

For a Cloudflare-backed service, start with an inventory like this:

```text
Origin TLS check

Zone: example.com
Encryption mode: Full (strict) preferred
Origin paths: www, api, app, static assets, admin
TLS 1.3 enabled at origin: yes/no per endpoint
Load balancers or middleboxes in path: list them
Cloudflare Tunnel used: yes/no
Policy need: observe automatic selection, require post-quantum hybrid, require FIPS, or no special requirement
Rollback owner: person/team that can change Cloudflare SSL/TLS settings quickly
```

Then verify whether the origin can negotiate the post-quantum group before tightening any compliance requirement. Cloudflare's docs suggest using BoringSSL's `bssl` client:

```bash
bssl client -connect origin.example.com:443 -curves X25519MLKEM768
```

The handshake output should show `ECDHE curve: X25519MLKEM768` when the origin supports that group. If the command fails, or if the stack does not have a recent TLS library available for testing, leave Automatic Key Exchange enabled but avoid forcing post-quantum-only policy until the origin is upgraded and tested.

## Cost And Operational Notes

Automatic Key Exchange is available on all Cloudflare plans, according to the docs. The main operational cost is not a new billable service; it is the care needed around TLS changes.

For most zones, the default posture is sensible: leave Automatic Key Exchange on and leave compliance requirements unselected unless there is a real policy reason to narrow the allowed algorithms. That lets Cloudflare prefer post-quantum key agreement where the origin already supports it, while keeping classical fallbacks available for the rest of the fleet.

Teams with many origins should pay attention to the zone-level behavior. Cloudflare says the same preference is applied for all of a zone's origins, derived from traffic-weighted scan results. If a zone hides several different origin stacks behind one hostname family, the busiest paths may shape the preference. That is usually reasonable, but it is worth knowing before moving a low-traffic but fragile legacy origin into the same zone.

Workers are also in scope when they make outbound requests for the zone. If a Worker path depends on an origin with unusual TLS behavior, include it in testing and incident runbooks.

## What We'd Watch Next

The next thing to watch is origin support for `X25519MLKEM768` across common hosting stacks. Cloudflare says origin support grew from 0.5% in 2023 to 12.8% by this rollout. That number will matter more as managed load balancers, CDN origins, Kubernetes ingress controllers, and TLS libraries update their defaults.

We would also watch the operational reporting. For teams running regulated or security-sensitive systems, it would be useful to see which origins were scanned, which group Cloudflare selected, when the preference changed, and whether any rollout was reverted.

The short version: keep the automatic measurement on, test before enforcing policy, and treat post-quantum origin TLS as a staged migration rather than a single checkbox.

## References

- [Cloudflare Blog: Automatic Key Exchange for origins](https://blog.cloudflare.com/automatic-key-exchange-for-origins/)
- [Cloudflare Docs: Automatic key exchange to origins](https://developers.cloudflare.com/ssl/origin-configuration/automatic-key-exchange/)
- [Cloudflare Docs: Post-quantum between Cloudflare and origin servers](https://developers.cloudflare.com/ssl/post-quantum-cryptography/pqc-to-origin/)
- [RFC 8446: The Transport Layer Security Protocol Version 1.3](https://www.rfc-editor.org/rfc/rfc8446.html)
