---
layout: post
title: "Targeted Rebuilds Beat Full Recomputes—If You Can Prove Them Safe"
date: 2026-11-03 04:13:00 -0600
categories: [infrastructure, engineering]
tags: [infrastructure, cloudflare, scheduling]
description: "Cloudflare cut DNS Zone Builder peak memory by 85% by planning the smallest safe rebuild, merging queued work, and proving targeted output against full recomputation."
image: "/assets/images/posts/targeted-rebuild-planner.png"
---

Cloudflare's DNS team just published a useful pattern for any system that turns source state into derived state: stop recomputing everything when one input changes, but keep full recomputation as the correctness oracle.

Its Zone Builder now plans the smallest build it can prove safe, merges compatible work for the same zone, and falls back to a full build when an event is ambiguous. Cloudflare reports that peak working-set memory fell from 79 GiB to 12 GiB and the largest observed p99 build-delay spike fell from 14.6 minutes to 1.21 minutes.

The DNS scale is unusual. The engineering pattern is not.

<!--more-->

## What Changed

Cloudflare receives roughly 700 DNS record changes per second, plus about 100 other events such as zone-setting changes. Some zones contain more than 20 million records. The old safe path for many setting changes was to read, encode, and compare the entire zone even when only the apex or shared metadata could change.

The new planner classifies work into five build types:

1. **Resources only:** rebuild specific DNS names.
2. **Resources and metadata:** rebuild names plus shared zone metadata.
3. **Apex and metadata:** rebuild the zone apex plus metadata.
4. **Purge:** remove a zone that should no longer be published.
5. **Full zone:** recompute everything when narrower work cannot be proven correct.

Over a 24-hour measurement, 92.95% of builds avoided a full-zone rebuild. Full builds remained 7.04% of the total. Cloudflare says the changes reduced the number of full builds by about 40%; the avoided work was larger than that count suggests because the removed full builds included very large zones.

## The Useful Design Rule

The planner's rule is stronger than “update only what probably changed”:

> Every key written by a targeted build must be byte-for-byte identical to what a full build would have written.

That turns optimization into a proof obligation. For each event class, the system needs to know:

- which derived keys can change;
- which shared metadata can change;
- which old keys may need removal; and
- which current state must be read again before writing.

Unknown or incomplete events still trigger a full build. The planner does not convert missing information into less work.

This is the part worth copying. An incremental path is safe only when the dependency boundary is explicit. If a job cannot explain its impact set, it has not earned the fast path.

## Separate Planning From Scheduling

Cloudflare also replaced separate record and full-zone schedulers with one scheduler that combines work for the same zone.

Suppose three events arrive before execution:

```text
event A -> rebuild resource /customers/42
event B -> rebuild resource /plans/basic + shared metadata
event C -> purge the tenant

merged plan -> purge
```

Merging is monotonic: it can add work, but it cannot discard a requirement. A full-build request promotes the combined plan to a full build. A purge overrides rebuild work because the desired final state is absence.

The scheduler keeps the work plan separate from the Kafka messages waiting for acknowledgement. Even if several resource requests collapse into a full build, their messages remain attached until the result is safely written. That distinction prevents a useful optimization from becoming a message-loss bug.

## Revalidate At Execution Time

An event describes past state. By the time a worker runs, the database may have changed again.

Cloudflare therefore plans twice:

1. The event creates a conservative initial work list.
2. Immediately before execution, the builder reads fresh publication state and can promote, purge, skip, or reconstruct shared metadata.

This matters beyond DNS. A cache invalidation event, search-index update, static-site build, policy compiler, or materialized view refresh can all wait behind newer writes. A precise event is useful for bounding work, but it should not be treated as a current-state snapshot unless the system guarantees that ordering.

A practical implementation shape is:

```text
event -> conservative impact plan -> merge by entity
      -> fresh state check -> execute -> compare/write -> acknowledge
```

Keep the transitions one-way toward equal or more conservative work. A fresh read may promote a targeted plan to a full rebuild; it should not silently narrow an already-required impact set.

## Prove The Fast Path Before Trusting It

Cloudflare used three layers of evidence:

- **Equivalence tests:** run full and targeted builds from the same database state, pin time-dependent values, and compare owned keys byte for byte.
- **Shadow execution:** initially run a full build beside each targeted build and compare outputs.
- **Production-stream mirroring:** consume production Kafka events and production database state, but write to an isolated Quicksilver environment that serves no customer traffic.

A comparer sampled 20% of zones for missing, extra, or different keys. Cloudflare then rolled out by a hash of the zone name so that zones sharing one metadata key always stayed on the same scheduler.

That rollout detail is easy to miss. If several entities can write one shared key, partition and deploy by the shared ownership boundary—not by an internal ID that happens to be convenient.

## A Small Test For Your Own Pipeline

This topic does not need a sample repository. The valuable artifact is a pipeline-specific equivalence test using real fixtures.

Choose one derived-state job and build a table like this:

| Event class | Smallest safe impact | Fresh state needed | Fallback |
| --- | --- | --- | --- |
| One source object changed | That object's derived keys | Current object version | Full entity rebuild |
| Shared setting changed | Known dependents + metadata | Current membership list | Full entity rebuild |
| Object deleted | Current and previous key set | Tombstone or prior identity | Full entity rebuild |
| Unknown event | Not provable | Complete current state | Full rebuild |

For every targeted row, run the incremental implementation and the full implementation from the same fixture. Compare the complete owned output, including deleted keys and metadata—not only the values expected to change.

Then mirror representative production inputs into a non-serving destination. Track mismatch categories, not just one aggregate mismatch rate. Timing differences, nondeterministic fields, stale reads, and real dependency errors need different responses.

## Cost And Operational Notes

No paid API or new managed service is required to apply this pattern. The costs are engineering and temporary duplicate compute:

- **Event quality:** producers must identify changed fields or emit enough previous state to remove stale output.
- **Dependency mapping:** every setting or object type needs an owned impact set.
- **Reference implementation:** the full path must remain correct and available as an oracle and fallback.
- **Shadow capacity:** parallel full and targeted builds cost extra during validation.
- **Observability:** plans, promotions, fallbacks, retries, mismatches, and acknowledgement state need metrics.
- **Partition safety:** shared-state ownership must align with queue partitioning and rollout boundaries.

Do not optimize only the average job. Cloudflare's typical builds were already small; the large benefit appeared in tail delay and memory pressure. Measure the worst work unit, queue head-of-line blocking, replay behavior after restart, and total working set.

Also keep the fallback boring. Cloudflare did not eliminate full builds because first publication, broad changes, and ambiguous events still require them. A cheap full rebuild for a small entity can be the right choice.

## What We'd Apply Elsewhere

The clearest candidates are systems with expensive derived state and uneven entity sizes:

- search and vector indexes;
- static-site and documentation builds;
- authorization-policy compilation;
- tenant configuration distribution;
- materialized views and analytics cubes;
- software-bill-of-materials generation; and
- deployment manifests assembled from many inputs.

Start with the event classes that repeatedly trigger the largest recomputes. Define the exact output they own, make the merge operation monotonic, revalidate current state before writing, and compare the targeted result against the full result until mismatches are understood.

The optimization is not “do less work.” It is “do the least work whose equivalence you can demonstrate.”

## References

- [Cloudflare: How we halved DNS build delay and cut memory use by 85%](https://blog.cloudflare.com/dns-targeted-zone-builds/)
- [Cloudflare: How we improved DNS propagation time by more than 10x](https://blog.cloudflare.com/dns-build-improvement/)
- [Cloudflare: Quicksilver configuration distribution at Internet scale](https://blog.cloudflare.com/introducing-quicksilver-configuration-distribution-at-internet-scale/)
- [Apache Kafka documentation: message delivery semantics](https://kafka.apache.org/documentation/#semantics)
