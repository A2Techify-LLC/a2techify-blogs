# uv 0.13.10 Closes a ZIP Parser Gap: Upgrade Your Python Build Images

LinkedIn newsletter draft for A2Techify Field Notes.

Source post: https://blogs.a2techify.com/security/engineering/2026/11/27/uv-zip-parser-security-upgrade.html
LinkedIn URL: TODO after publishing

## Newsletter Title

uv 0.13.10 Closes a ZIP Parser Gap: Upgrade Your Python Build Images

## Intro

uv 0.13.10 rejects ZIP archives whose size records disagree, closing a parser differential that could hide Python code from other tooling.

## Takeaways

- uv 0.1.29 through 0.13.9 could extract different content than pip from the same hash-verified ZIP archive.
- uv 0.13.10 rejects members whose data descriptor and central directory disagree about compressed size.
- Upgrade pinned CI and container copies, rebuild long-lived images, then run `uv lock --check` and the normal locked test path.
- A matching digest proves byte identity; it does not prove that two parsers interpret those bytes identically.

## CTA

Read the full note: https://blogs.a2techify.com/security/engineering/2026/11/27/uv-zip-parser-security-upgrade.html

## Publishing Notes

- Publish manually from the A2Techify LinkedIn Page newsletter editor.
- After publishing, add the LinkedIn newsletter URL to the source post front matter as `linkedin_url`.
- Keep the blog post as the canonical article.

Topics: security, supply-chain, devtools
