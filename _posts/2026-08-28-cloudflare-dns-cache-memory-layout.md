---
layout: post
title: "Cloudflare Shows Why Cache Layout Still Matters"
date: 2026-08-28 07:30:00 -0500
categories: [engineering, infrastructure]
tags: [cloudflare, infrastructure, security]
description: "Cloudflare's 1.1.1.1 DNS cache work is a practical reminder that high-cardinality systems need memory layout reviews, not just bigger machines."
image: "/assets/images/posts/cloudflare-dns-cache-memory-layout.png"
---

Cloudflare published a useful deep dive on how its team cut the memory footprint of the 1.1.1.1 DNS cache by changing data layout, not by changing the product promise. The headline number is large: roughly 100 TB of memory freed across the fleet.

The practical lesson is smaller and more reusable. If a service keeps hundreds of millions or billions of objects hot, every pointer, capacity field, enum shape, allocation, and duplicate string becomes an infrastructure decision.

<!--more-->

## What Changed

Cloudflare says Big Pineapple, the platform behind 1.1.1.1, Gateway DNS, DNS Firewall, AS112, and other DNS services, stores more than 250 billion DNS cache entries at any time. At that scale, one wasted byte per entry adds up to more than 250 GB of memory across the fleet.

The team made five storage changes to the cache entry layout. According to Cloudflare, those changes cut per-entry memory by 56%, freed roughly 100 TB of memory, improved insert throughput by 43%, and reduced lookup latency by 19%.

That is the interesting part: the cache became smaller and faster. This was not a compression story where every lookup pays a new CPU tax. It was a layout story where the hot path did less allocation work and had better locality.

## Why We're Paying Attention

Most teams will never operate a DNS resolver at Cloudflare scale. But many teams are building systems with the same high-cardinality shape.

- RAG indexes with millions of chunks and metadata records.
- Agent event stores with every tool call, observation, and trace.
- Feature stores and online caches with high-cardinality keys.
- Auth, rate-limit, and policy caches sitting on the request path.
- Observability pipelines where labels and attributes multiply quickly.

The mistake is assuming this only matters to infrastructure giants. Once an object is multiplied by enough tenants, documents, users, traces, or cache keys, "just one field" becomes real money and real latency.

## How It Works

Cloudflare's examples are Rust-specific, but the thinking is language-independent.

First, the team replaced growable collections with fixed-size owned data where cached values do not change after insertion. A `Vec<T>` carries pointer, length, and capacity. A `Box<[T]>` does not need spare capacity because it cannot grow. The same idea applies to `String` and `Box<str>`.

Second, they reduced the number of separate lists. Instead of storing DNS answer, authority, and additional records as separate collections, the cache can store one record list and keep offsets into it. That removes extra pointer and length fields.

Third, they stopped storing data that can be inferred safely. Many DNS records have the same owner as the queried domain. For those cases, the cache can represent the owner as absent and reconstruct it from the cache key during response construction.

Fourth, they looked at enum sizing. A Rust enum takes enough space for its largest variant, plus the tag and padding. If the largest DNS record shape is rare but the common records are small, the common case can waste memory. Boxing large variants helps, but it also adds allocator overhead and pointer chasing, so Cloudflare went further.

Finally, they stored record data in a compact byte representation while keeping enough structure around it to avoid reparsing entire DNS messages on each lookup.

## A Small Useful Test

This post does not need a sample repo. The useful action is not cloning a demo cache. It is checking one of your own hot structs or rows before the next scale problem appears.

For a Rust service, start with a quick size check around the object you store the most:

```rust
use std::mem::size_of;

#[derive(Debug)]
struct CachedChunk {
    id: String,
    tenant: String,
    tokens: Vec<u32>,
    embedding_id: Option<String>,
    flags: Vec<String>,
}

#[derive(Debug)]
struct PackedCachedChunk {
    id: Box<str>,
    tenant: Box<str>,
    tokens: Box<[u32]>,
    embedding_id: Option<Box<str>>,
    flags: Box<[Box<str>]>,
}

fn main() {
    println!("CachedChunk: {} bytes", size_of::<CachedChunk>());
    println!("PackedCachedChunk: {} bytes", size_of::<PackedCachedChunk>());
}
```

That does not prove the packed version is better. It only shows whether the type has enough per-object overhead to justify a benchmark.

The better review is this checklist:

```text
Hot object memory review

1. Count how many copies exist at peak, not average.
2. Separate mutable build-time data from immutable stored data.
3. Replace growable fields after insertion when the value will not grow.
4. Look for repeated strings, repeated owners, repeated labels, and repeated metadata.
5. Check enum or union shapes where rare variants force common variants to be large.
6. Benchmark allocation count, resident memory, insert throughput, and lookup latency together.
7. Roll out behind measurement, because allocator behavior and production traffic mix matter.
```

This is especially relevant for AI systems. Vector search and agent logs often begin as flexible JSON-like structures. That is fine while the data is small. It becomes expensive when every trace, chunk, label, and tool result stays queryable.

## Cost And Operational Notes

The cheapest memory is the memory you do not allocate on every hot entry. But layout work has tradeoffs.

Fixed-size representations can make mutation harder. Inferred fields can make an object less self-contained. Compact byte storage can move complexity into encoding and decoding paths. Boxing large enum variants can save space for common cases while adding heap allocations for uncommon cases.

That means the decision should be measured, not aesthetic. Track at least these numbers before and after:

- Bytes per entry or row.
- Allocation count per insert and lookup.
- Resident memory after warmup.
- Insert throughput.
- Lookup latency.
- Error rate during rollout.

For small teams, the useful habit is simple: review the top three high-cardinality objects before buying more memory. If the object count is growing faster than revenue or traffic value, data layout is a product cost.

## What We'd Watch Next

The same design pressure is moving into agent infrastructure.

Every serious agent platform is accumulating traces, messages, tool calls, embeddings, safety annotations, file references, and retry metadata. Those records are valuable because they explain what happened. They are also easy to store in a shape that is pleasant for developers and expensive for operations.

Cloudflare's post is a good reminder to do the boring accounting early. When a system's unit economics depend on object count, memory layout is not a micro-optimization. It is capacity planning.

## References

- [Cloudflare Blog: How we saved 100 terabytes of memory by optimizing 1.1.1.1's DNS cache](https://blog.cloudflare.com/dns-cache-memory-optimization-1111/)
- [Cloudflare Blog: Introducing Big Pineapple](https://blog.cloudflare.com/big-pineapple-intro/)
- [Rust standard library: `Box`](https://doc.rust-lang.org/std/boxed/struct.Box.html)
- [The Rustonomicon: `repr(Rust)`](https://doc.rust-lang.org/nomicon/repr-rust.html)
