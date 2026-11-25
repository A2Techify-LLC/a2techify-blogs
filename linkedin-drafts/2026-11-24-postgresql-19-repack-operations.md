# PostgreSQL 19 Adds Online REPACK: Budget the Disk Before You Run It

LinkedIn newsletter draft for A2Techify Field Notes.

Source post: https://blogs.a2techify.com/databases/engineering/2026/11/24/postgresql-19-repack-operations.html
LinkedIn URL: TODO after publishing

## Newsletter Title

PostgreSQL 19 Adds Online REPACK: Budget the Disk Before You Run It

## Intro

PostgreSQL 19 adds built-in concurrent table repacking, plan advice, read-your-writes on standbys, and a simpler get-or-create statement.

## Takeaways

- `REPACK (CONCURRENTLY)` moves online table rewrites into core PostgreSQL, but it still needs room for another copy of the table and indexes, produces WAL, and has an old-snapshot caveat.
- PostgreSQL 19 also adds atomic `INSERT ... ON CONFLICT DO SELECT`, explicit read-your-writes coordination on standbys, plan advice, and smarter autovacuum scheduling.
- Treat version 19 as a major database migration: prove extension support, rehearse `pg_upgrade` or dump/restore, and measure the changed JIT and TOAST compression defaults.

## CTA

Read the full note: https://blogs.a2techify.com/databases/engineering/2026/11/24/postgresql-19-repack-operations.html

## Publishing Notes

- Publish manually from the A2Techify LinkedIn Page newsletter editor.
- After publishing, add the LinkedIn newsletter URL to the source post front matter as `linkedin_url`.
- Keep the blog post as the canonical article.

Topics: infrastructure, devtools
