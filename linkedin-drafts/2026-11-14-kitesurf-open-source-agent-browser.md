# Kitesurf Is Open Source: Test an Agent Browser Without Chromium

LinkedIn newsletter draft for A2Techify Field Notes.

Source post: https://blogs.a2techify.com/ai/engineering/2026/11/14/kitesurf-open-source-agent-browser.html
LinkedIn URL: TODO after publishing

## Newsletter Title

Kitesurf Is Open Source: Test an Agent Browser Without Chromium

## Intro

Cloudflare has open-sourced Kitesurf, an experimental browser engine for agents that speaks CDP without running Chromium. Here is what to test before treating it as a browser replacement.

## Takeaways

- Engine, which manages browser sessions and CDP client connections; PageScript, which runs the page, DOM APIs, and JavaScript; and PageRenderer, which turns the recorded page scene into...
- Browser automation usually brings a full browser, its process model, a container image, and the operational work needed to keep all of that patched and isolated.
- Start with a read-only task against public pages: extract a known field, capture a screenshot, or verify a page state.

## CTA

Read the full note: https://blogs.a2techify.com/ai/engineering/2026/11/14/kitesurf-open-source-agent-browser.html

## Publishing Notes

- Publish manually from the A2Techify LinkedIn Page newsletter editor.
- After publishing, add the LinkedIn newsletter URL to the source post front matter as `linkedin_url`.
- Keep the blog post as the canonical article.

Topics: agents, cloudflare, devtools
