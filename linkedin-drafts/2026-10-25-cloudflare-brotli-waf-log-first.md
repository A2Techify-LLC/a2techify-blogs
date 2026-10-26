# Cloudflare's Brotli WAF Rules Start in Log Mode for a Reason

LinkedIn newsletter draft for A2Techify Field Notes.

Source post: https://blogs.a2techify.com/security/engineering/2026/10/25/cloudflare-brotli-waf-log-first.html
LinkedIn URL: TODO after publishing

## Newsletter Title

Cloudflare's Brotli WAF Rules Start in Log Mode for a Reason

## Intro

Cloudflare added emergency WAF detections for Brotli request bodies and the Next.js image endpoint, but operators should audit inherited overrides before changing either rule from Log to Block.

## Takeaways

- a Brotli rule that matches incoming requests declaring Content-Encoding: br; and a Next.js rule that matches the framework's /next/image endpoint.
- We would watch for a detailed upstream advisory that maps CVE-2026-111497 to affected and fixed versions.

## CTA

Read the full note: https://blogs.a2techify.com/security/engineering/2026/10/25/cloudflare-brotli-waf-log-first.html

## Publishing Notes

- Publish manually from the A2Techify LinkedIn Page newsletter editor.
- After publishing, add the LinkedIn newsletter URL to the source post front matter as `linkedin_url`.
- Keep the blog post as the canonical article.

Topics: cloudflare, security, infrastructure
