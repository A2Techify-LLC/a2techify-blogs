---
layout: post
title: "PostgreSQL 19 Adds Online REPACK: Budget the Disk Before You Run It"
date: 2026-11-24 07:30:00 -0600
categories: [databases, engineering]
tags: [infrastructure, devtools]
description: "PostgreSQL 19 adds built-in concurrent table repacking, plan advice, read-your-writes on standbys, and a simpler get-or-create statement."
image: "/assets/images/posts/postgresql-19-repack-operations.png"
---

PostgreSQL 19 is available, and its most operationally interesting feature is a built-in way to rewrite bloated tables without blocking normal reads and writes for most of the job.

`REPACK (CONCURRENTLY)` moves a job that often required an extension or a maintenance window into core PostgreSQL. That is useful, but “concurrently” does not mean free or invisible. The command creates another copy of the table and its indexes, captures ongoing changes through logical decoding, briefly takes an `ACCESS EXCLUSIVE` lock for the final swap, and has an MVCC caveat for transactions holding old snapshots.

The release also adds plan advice, smarter autovacuum work scheduling, read-your-writes consistency on standbys, logical replication of sequences, and a cleaner get-or-create statement. PostgreSQL 19 is a meaningful upgrade. It still deserves a measured rollout rather than an automatic image-tag change.

<!--more-->

## What Changed

PostgreSQL 19 was released on November 19, 2026. The headline operational additions include:

- `REPACK` and `REPACK (CONCURRENTLY)` for reclaiming table and index space by rewriting them;
- `pg_plan_advice` and `pg_stash_advice` for testing and applying query-plan guidance;
- parallel index vacuuming and a scoring system that helps autovacuum prioritize work;
- `WAIT FOR LSN` for coordinating reads on asynchronous standbys after a write;
- logical replication of sequence values;
- `INSERT ... ON CONFLICT DO SELECT` for atomic get-or-create behavior; and
- new monitoring views for locks, recovery, and autovacuum scores.

There are defaults to review too. Just-in-time compilation is disabled by default because the cost estimates used to enable it were not reliable enough. Builds with LZ4 support now use LZ4 as the default TOAST compression method. RADIUS authentication support is removed, and successful MD5 password authentication produces a warning as PostgreSQL continues moving users toward SCRAM.

## Why Built-In REPACK Matters

Ordinary `VACUUM` makes dead tuple space reusable inside a table, but it generally does not return that space to the operating system. `VACUUM FULL` rewrites the table and returns space, but holds an `ACCESS EXCLUSIVE` lock while it works. That can be unacceptable for a busy application.

PostgreSQL 19's concurrent repack performs the bulk copy under a less restrictive lock. It records concurrent changes through logical decoding, applies them to the replacement files, then takes an `ACCESS EXCLUSIVE` lock for the final catch-up and file swap. The final lock should be short, but it can still wait behind other transactions and briefly block new work.

A targeted command looks like this:

```sql
REPACK (CONCURRENTLY, VERBOSE) public.events;
```

To reorder the table according to its configured clustering index and refresh planner statistics afterward:

```sql
REPACK (CONCURRENTLY, ANALYZE, VERBOSE)
  public.events USING INDEX;
```

`ANALYZE` is currently supported only when one non-partitioned table is specified. Concurrent mode also has eligibility requirements: the table must be a logged heap table, cannot be partitioned, and needs a primary key plus index-based replica identity. The server setting `max_repack_replication_slots` must allow another slot.

## The Capacity Check Comes First

The official documentation says `REPACK` creates a temporary copy of the table **and all of its indexes**. At minimum, free space must cover their combined size. Repacking with `USING INDEX` can also need a sort file up to the size of the table if the planner chooses a sequential scan and sort.

Start with a size estimate:

```sql
SELECT
  pg_size_pretty(pg_relation_size('public.events')) AS table_only,
  pg_size_pretty(pg_indexes_size('public.events')) AS indexes,
  pg_size_pretty(pg_total_relation_size('public.events')) AS total;
```

Do not treat `total` as a perfect reservation. Leave room for WAL, captured concurrent changes, temporary sort files, normal database growth, and the rest of the cluster. Test the operation against a production-shaped copy while generating representative write traffic.

Monitor the repack through `pg_stat_progress_repack`. Also watch free disk space, WAL generation, replication lag, lock waits, and the repack backend's `backend_xid`. The command is one long-running transaction for transaction-ID purposes, so a very large repack can delay cleanup elsewhere.

## The Snapshot Caveat Is Not Optional Reading

The PostgreSQL documentation explicitly says concurrent repack is not MVCC-safe. After the swap commits, a concurrent transaction using a snapshot taken before repacking began can see the table as empty.

That makes long-running transactions, analytical exports, idle-in-transaction sessions, and jobs using repeatable-read snapshots part of the change plan. Before starting:

1. find unusually old transactions and exported snapshots;
2. stop or reschedule workloads that hold snapshots for a long time;
3. set an operational limit for how long the repack may run;
4. confirm the application can tolerate the brief final lock; and
5. rehearse cancellation and retry behavior on a restore or replica-sized test environment.

Concurrent DDL on the target can make the command fail. Heavy updates and deletes increase the change stream that must be stored and replayed. A failed repack late in the process still consumes time and I/O, so schedule it as controlled maintenance even when the application stays online.

## A Useful Developer Test: Get Or Create Without A Dummy Update

PostgreSQL 19 also simplifies a common application path. Previously, teams often used `ON CONFLICT DO UPDATE` merely to get the existing row back, even when no update was needed, or made another query after `DO NOTHING`.

The new `DO SELECT` action atomically inserts or returns the conflicting row:

```sql
CREATE TABLE api_clients (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_key text UNIQUE NOT NULL,
  display_name text NOT NULL
);

INSERT INTO api_clients (external_key, display_name)
VALUES ('customer-42', 'Example Customer')
ON CONFLICT (external_key) DO SELECT
RETURNING id, external_key, display_name;
```

Run the `INSERT` twice. Both calls return one row, while the table still contains one record. This is an atomic insert-or-select operation; `RETURNING` is required, and the caller needs the relevant `SELECT` privileges in addition to `INSERT`.

This post does not need a separate sample repository. The behavior is best understood with a few SQL statements against a disposable PostgreSQL 19 instance, and another repository would add maintenance without improving the test.

## Standby Reads Gain An Explicit Consistency Tool

For applications that write to a primary and immediately read from an asynchronous standby, PostgreSQL 19 adds:

```sql
WAIT FOR LSN '0/0306EE20'
  WITH (TIMEOUT '500ms', NO_THROW);
```

The application records an LSN on the primary after the relevant commit, sends it to the standby, waits for replay, and only then runs the read. `NO_THROW` returns `success`, `timeout`, or `not in recovery`, so the application can fall back to the primary or retry deliberately.

There are sharp edges. A zero or omitted timeout waits indefinitely. `WAIT` must run as a top-level command, before the session holds a snapshot or lock. LSN comparison is numeric and does not validate the timeline, so applications that cross promotions or cascading replication changes need additional timeline handling.

## Cost And Operational Notes

- **PostgreSQL remains open source.** There is no license or API charge for these features. The real costs are test environments, storage headroom, I/O, replication bandwidth, and operator time.
- **This is a major upgrade.** PostgreSQL's versioning policy requires `pg_upgrade` or dump and restore; replacing a container image while reusing the old data directory is not an upgrade plan.
- **Extension compatibility can lag.** Check every required extension, driver, backup tool, pooler, observability agent, and managed-service release schedule before choosing a date.
- **Keep the rollback boundary clear.** Take and verify a backup, preserve the old cluster until acceptance tests pass, and document the point after which writes prevent a simple rollback.
- **Measure changed defaults.** Analytical workloads that benefited from JIT should test enabling it explicitly. Storage and CPU behavior may change with LZ4 TOAST compression.
- **Finish the authentication migration.** MD5 is deprecated and now warns on successful use. New work should use SCRAM rather than suppressing the warning.
- **PostgreSQL 14 is now unsupported.** The official versioning page lists 14.25 as its final release, so teams still on 14 need an upgrade plan even if they do not move directly to 19.

## What We'd Watch Next

The first production reports around concurrent repack will matter more than small synthetic benchmarks: final-lock duration, WAL volume, failure behavior under write-heavy workloads, and how operators size scratch space.

We would also watch client and framework support for `ON CONFLICT DO SELECT`, managed-service availability for PostgreSQL 19, and whether plan advice becomes a disciplined incident tool or a collection of permanent hints no one remembers to revisit.

The practical first move is not to repack the biggest table. Build a PostgreSQL 19 test cluster from a recent restore, inventory extension support, run the get-or-create test, and rehearse one modest repack while recording disk, WAL, locks, and replication lag. That produces an upgrade decision based on your workload rather than the release headline.

## References

- [PostgreSQL Global Development Group: PostgreSQL 19 released](https://www.postgresql.org/about/news/postgresql-19-released-3449/)
- [PostgreSQL 19 release notes](https://www.postgresql.org/docs/19/release-19.html)
- [PostgreSQL 19 REPACK documentation](https://www.postgresql.org/docs/19/sql-repack.html)
- [PostgreSQL 19 INSERT documentation](https://www.postgresql.org/docs/19/sql-insert.html)
- [PostgreSQL 19 WAIT documentation](https://www.postgresql.org/docs/19/sql-wait.html)
- [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/)
