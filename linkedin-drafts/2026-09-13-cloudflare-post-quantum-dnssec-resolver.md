# Cloudflare 1.1.1.1 Makes Post-Quantum DNSSEC Practical to Test

LinkedIn newsletter draft for A2Techify Field Notes.

Source post: https://blogs.a2techify.com/security/infrastructure/2026/09/13/cloudflare-post-quantum-dnssec-resolver.html
LinkedIn URL: TODO after publishing

## Newsletter Title

Cloudflare 1.1.1.1 Makes Post-Quantum DNSSEC Practical to Test

## Intro

Cloudflare's 1.1.1.1 resolver now validates ML-DSA-44 DNSSEC signatures, exposing the real migration work: large packets, TCP fallback, downgrade policy, and parent-chain adoption.

## Takeaways

- Cloudflare says 1.1.1.1 now validates DNSSEC signatures made with ML-DSA-44, the NIST-standardized post-quantum signature algorithm.
- Post-quantum migration usually gets discussed as a cryptography problem. This release is a reminder that the protocol and operations work may be the slowest part.
- DNSSEC validation follows a signed chain.
- The next signal to watch is authoritative DNS and registrar support.

## CTA

Read the full note: https://blogs.a2techify.com/security/infrastructure/2026/09/13/cloudflare-post-quantum-dnssec-resolver.html

## Publishing Notes

- Publish manually from the A2Techify LinkedIn Page newsletter editor.
- After publishing, add the LinkedIn newsletter URL to the source post front matter as `linkedin_url`.
- Keep the blog post as the canonical article.

Topics: cloudflare, security, infrastructure
