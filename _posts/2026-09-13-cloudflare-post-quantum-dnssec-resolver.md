---
layout: post
title: "Cloudflare 1.1.1.1 Makes Post-Quantum DNSSEC Practical to Test"
date: 2026-09-13 07:30:00 -0500
categories: [security, infrastructure]
tags: [cloudflare, security, infrastructure]
description: "Cloudflare's 1.1.1.1 resolver now validates ML-DSA-44 DNSSEC signatures, exposing the real migration work: large packets, TCP fallback, downgrade policy, and parent-chain adoption."
image: "/assets/images/posts/cloudflare-post-quantum-dnssec-resolver.png"
---

Cloudflare turned on ML-DSA-44 validation in the 1.1.1.1 resolver. That sounds narrow, but it is one of the more useful post-quantum moves because it tests a real Internet protocol at resolver scale instead of keeping the work in a lab.

The interesting part is not just the cryptography. DNSSEC already has algorithm agility on paper. The harder work is operational: a single ML-DSA-44 signature is 2,420 bytes, DNS still has old packet-size assumptions, and zones will need to carry conventional and post-quantum signatures during a long migration without letting capable resolvers silently downgrade.

<!--more-->

## What Changed

Cloudflare says 1.1.1.1 now validates DNSSEC signatures made with ML-DSA-44, the NIST-standardized post-quantum signature algorithm. IANA has assigned ML-DSA-44 DNSSEC algorithm number 18, and Cloudflare is using the resolver side of 1.1.1.1 to measure what happens when these larger signatures start moving through real networks.

Nothing changes for normal 1.1.1.1 users today. Existing DNSSEC zones continue to validate as before. The new behavior matters when a zone publishes the necessary ML-DSA-44 DNSSEC records. In that case, a resolver that supports the algorithm can validate a post-quantum path instead of relying only on RSA or ECDSA signatures.

Cloudflare's next step is signing support in Cloudflare Authoritative DNS and corresponding DS record support in Cloudflare Registrar. That is where the test becomes more complete, because DNSSEC security depends on a chain from the trust anchor through each parent delegation.

## Why We're Paying Attention

Post-quantum migration usually gets discussed as a cryptography problem. This release is a reminder that the protocol and operations work may be the slowest part.

DNSSEC protects authenticity, not confidentiality, so it is not the classic "harvest now, decrypt later" case. An attacker cannot save today's DNSSEC-signed response and decrypt it later. The future risk is different: if a quantum-capable attacker can recover a signing key for an important zone, especially high in the DNS hierarchy, they can forge signed answers that older validation paths may accept.

That makes early deployment testing useful even before the threat is immediate. DNS involves resolvers, authoritative servers, registries, registrars, libraries, network middleboxes, and client access networks. A change that looks simple in a spec can fail because a packet is too large, a TCP retry path is weak, a parent zone cannot publish the right DS record, or a validator accepts a conventional signature when a post-quantum path should have been required.

## How It Works

DNSSEC validation follows a signed chain. A resolver starts from a trust anchor, checks delegation records, fetches DNSKEY and RRSIG records, and proves that the answer came from the right zone and was not modified.

ML-DSA-44 changes two practical parts of that process.

First, the signatures are large. Cloudflare's comparison puts ECDSA P-256 signatures at 64 bytes and ML-DSA-44 signatures at 2,420 bytes. The ML-DSA-44 public key is also 1,312 bytes. A DNSKEY response carrying both conventional and post-quantum material can easily exceed conservative DNS-over-UDP payload limits. The right behavior is usually to return a truncated UDP response and retry over TCP or another transport, not to depend on fragmented UDP.

Second, the migration needs downgrade protection. During a transition, many zones will publish both conventional and post-quantum signatures. Older resolvers need the conventional path. Post-quantum-capable resolvers need a way to avoid accepting a forged conventional-only path after a zone has signaled that ML-DSA-44 should be used.

Cloudflare's answer is local resolver policy. If the authenticated DS RRset from the parent zone includes a supported post-quantum algorithm, 1.1.1.1 requires at least one valid post-quantum validation path. A conventional path alone is not enough in that case.

```text
Parent zone DS RRset says ML-DSA-44 is present
  -> resolver supports ML-DSA-44
  -> resolver must validate a post-quantum path
  -> conventional-only success is treated as insufficient
```

That policy is the useful detail. Compatibility can stay available for older validators without becoming a fallback that weakens newer validators.

## A Small Useful Test

This post does not need a sample repo. The most useful check is a resolver behavior test you can run from a shell with `dig`.

Cloudflare's post shows an ML-DSA-44 test domain returning a truncated UDP response before retrying over TCP. Try the same kind of check against 1.1.1.1:

```bash
dig @1.1.1.1 mldsa44.dnstest.dev DNSKEY +dnssec
```

The important things to look for are not just whether the command returns records. Look for signs that the resolver handled the larger response correctly, such as a UDP truncation warning followed by a TCP answer, DNSSEC records in the response, and the authenticated-data behavior your local tooling reports.

For a lightweight operations review, use this checklist before trying to sign production zones with a post-quantum algorithm:

```text
Post-quantum DNSSEC readiness review

Can the authoritative DNS platform sign with ML-DSA-44?
Can the registrar publish the corresponding DS records?
Do validators on the path support algorithm 18?
Are large DNSKEY responses handled without relying on UDP fragmentation?
Do monitoring probes distinguish UDP truncation, TCP retry, and validation failure?
Is downgrade policy documented for mixed conventional and post-quantum signing?
Is the parent chain protected, or is there still a conventional-only link above the zone?
```

For most teams, the right action today is measurement, not a rushed production migration. Know which resolvers your users rely on, how your DNS provider handles large DNSSEC responses, and whether your alerting treats TCP fallback as normal behavior for large signed answers.

## Cost And Operational Notes

There is no new paid service required to benefit from 1.1.1.1 validation. If you use 1.1.1.1, Cloudflare says the resolver-side validation happens automatically when the zone publishes the needed records. The test domain and shell checks are free.

The costs show up in operations:

- Larger DNSKEY and RRSIG responses can increase bandwidth and TCP retry volume between resolvers and authoritative servers.
- DNS monitoring needs to understand truncation and retry behavior so a healthy large response is not mistaken for an outage.
- Mixed-algorithm signing needs careful policy because compatibility with old validators can create a downgrade path for new validators.
- A zone is not fully post-quantum secure until the chain above it also carries and enforces post-quantum protection.

The migration will likely be uneven for a while. That is normal. The useful thing about 1.1.1.1 support is that implementers can start finding real transport and validation problems while the ecosystem still has time to fix them.

## What We'd Watch Next

The next signal to watch is authoritative DNS and registrar support. Resolver validation proves one side of the path. Signing zones, publishing DS records, and watching parent-chain behavior will show where the migration gets stuck.

We would also watch how DNS observability tools present this. Operators need simple visibility into response size, truncation, TCP retry rates, validation failures by algorithm, and whether a failure was cryptographic or transport-related. Without that, post-quantum DNSSEC will look like random DNS flakiness to the team on call.

The short version: Cloudflare did not make DNSSEC magically post-quantum. It made the migration concrete enough to test. That is the part builders should care about.

## References

- [Cloudflare Blog: 1.1.1.1 now supports post-quantum DNSSEC, all 2,420 bytes of it](https://blog.cloudflare.com/post-quantum-dnssec-1111/)
- [IANA: Domain Name System Security Algorithm Numbers](https://www.iana.org/assignments/dns-sec-alg-numbers#dns-sec-alg-numbers-1)
- [IETF Datatracker: ML-DSA for DNSSEC Internet-Draft](https://datatracker.ietf.org/doc/draft-westerbaan-dnssec-mldsa/)
- [RFC 4033: DNS Security Introduction and Requirements](https://datatracker.ietf.org/doc/html/rfc4033)
- [RFC 9715: DNS Transport over TCP, Operational Requirements](https://datatracker.ietf.org/doc/html/rfc9715)
- [Cloudflare test page: Is your DNS resolver post-quantum ready?](https://dnstest.dev/post-quantum/)
