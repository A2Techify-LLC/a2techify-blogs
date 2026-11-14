---
layout: post
title: "Kitesurf Is Open Source: Test an Agent Browser Without Chromium"
date: 2026-11-14 09:51:00 -0600
categories: [ai, engineering]
tags: [agents, cloudflare, devtools]
description: "Cloudflare has open-sourced Kitesurf, an experimental browser engine for agents that speaks CDP without running Chromium. Here is what to test before treating it as a browser replacement."
image: "/assets/images/posts/kitesurf-open-source-agent-browser.png"
---

Cloudflare has open-sourced Kitesurf, its experimental browser engine for AI agents, under the Apache 2.0 license. Kitesurf parses HTML, applies CSS, runs page JavaScript, and renders screenshots without launching Chrome or a browser container.

The interesting part is not that it can take a screenshot. It is that existing tools can connect through the Chrome DevTools Protocol (CDP), while the engine underneath is a set of Workers and WebAssembly components rather than a Chromium process tree.

That could make browser tasks much lighter. It also means teams need to test web compatibility and security boundaries instead of assuming that "speaks CDP" means "behaves exactly like Chrome."

<!--more-->

## What Changed

The full Kitesurf repository is now public. Its three major runtime pieces are:

- **Engine**, which manages browser sessions and CDP client connections;
- **PageScript**, which runs the page, DOM APIs, and JavaScript; and
- **PageRenderer**, which turns the recorded page scene into an image.

The implementation combines several open-source Rust projects compiled to WebAssembly. Blitz provides HTML, DOM, layout, and painting; Stylo handles CSS; Boa is a JavaScript fallback; and Linebender libraries plus Krilla handle graphics, text, and PDF output.

For an agent developer, the boundary that matters is CDP. Puppeteer and other CDP clients can connect to Kitesurf's browser WebSocket endpoint without learning a new browser-control API.

## Why It Matters

Browser automation usually brings a full browser, its process model, a container image, and the operational work needed to keep all of that patched and isolated. Kitesurf is trying a different trade: implement the browser capabilities agents need on Workers and WebAssembly, then expose a familiar control protocol.

Cloudflare's current benchmark page reports a median of **50 MiB** for a typical screenshot task in Kitesurf, compared with **400 MiB** for Browser Run and **329 MiB** for a cold Chrome process tree. For HTML output, it reports 29 MiB, 398 MiB, and 316 MiB respectively.

Those are Cloudflare's measurements, not a universal capacity plan. The same benchmark shows that Kitesurf's median wall time can be slower on complex pages. Across its 38-page corpus, a typical screenshot took 1.79 seconds in Kitesurf, 1.20 seconds in Browser Run, and 1.01 seconds in cold Chrome. Some pages were much farther apart, and one page failed to render in Kitesurf.

The practical hypothesis is therefore narrower than "replace Chromium": Kitesurf may be useful when memory and isolation density matter more than perfect browser compatibility, especially for known page sets and controlled workflows.

## Run a Small Local Check

Local development does not require a paid Cloudflare plan. The repository currently requires Bazelisk, Node.js 22 or newer, and its pinned pnpm 9.15.4. The first build compiles the Rust and WebAssembly pieces, so expect it to take longer than later cached builds.

```bash
git clone https://github.com/cloudflare/kitesurf.git
cd kitesurf
pnpm install --frozen-lockfile
pnpm run dev
```

Wrangler starts the local engine at `http://127.0.0.1:8787`. Check the health endpoint before involving an agent:

```bash
curl --fail http://127.0.0.1:8787/health
```

Then connect with `puppeteer-core` and perform one deterministic task:

```js
import puppeteer from "puppeteer-core";

const browser = await puppeteer.connect({
  browserWSEndpoint: "ws://127.0.0.1:8787/devtools/browser",
});

try {
  const page = await browser.newPage();
  await page.goto("https://example.com/", { waitUntil: "domcontentloaded" });
  console.log(await page.title());
  await page.screenshot({ path: "example.png" });
} finally {
  await browser.disconnect();
}
```

Do not stop at `example.com`. Build a small test set from the pages and actions your agent actually uses: authentication redirects, forms, client-rendered tables, downloads, pop-ups, iframes, and failure recovery. Compare outputs against your current Chromium automation and keep the expected DOM assertions alongside screenshot checks.

No new A2Techify sample repository is needed here. Cloudflare's repository is already the runnable source, and a wrapper repo around a short Puppeteer connection example would add maintenance without clarifying the architecture.

## Compatibility Is The Main Constraint

Kitesurf is explicitly experimental and is not a full Chrome implementation. Its public Web Platform Tests dashboard reported 98.3% of enrolled subtests passing on November 13, but only 9,093 of 11,764 enrolled test files passed. Another 56,854 files were skipped, mostly because they were not enrolled.

The folder-level results show why the aggregate percentage needs context. The reported pass rate was 98.6% for enrolled DOM subtests and 96.6% for HTML, but 74.0% for Fetch, 68.0% for Shadow DOM, 58.3% for WebAssembly, and 45.1% for High Resolution Time.

Those numbers will change as the project develops. They are useful as a map of where to probe, not as a guarantee for a production workload. A workflow can depend on one missing API even when most unrelated subtests pass.

## Cost And Operational Notes

- **Local testing is free:** `wrangler dev` runs the engine locally. The cost is build time, local CPU, and disk used by Bazel and dependency caches.
- **Cloud deployment is paid:** Kitesurf uses Dynamic Workers to isolate pages, and Cloudflare says a Workers Paid plan is required to deploy it there. Review Dynamic Workers pricing before designing around hosted scale.
- **Authentication is not built in:** the repository warns against deploying the engine without an authentication layer. Anyone who can reach the endpoint can connect a CDP client and browse through it. Cloudflare recommends Access or another authentication control.
- **CDP support is partial:** a compatible connection endpoint does not imply that every Puppeteer method or DevTools feature works. Pin the Kitesurf revision and run your own regression suite before upgrades.
- **Browser security still applies:** isolate untrusted pages, limit network reach, protect credentials, and treat page content as hostile input. A lighter engine is not a smaller trust decision by itself.
- **Benchmarks are workload-specific:** measure end-to-end latency, CPU, memory, failure rate, and page fidelity on the same pages with the same success criteria.

## What We'd Watch Next

Start with a read-only task against public pages: extract a known field, capture a screenshot, or verify a page state. Run that task through Kitesurf and your current browser backend with identical assertions.

If compatibility holds, add concurrency and measure the resource curve. Only then test authenticated or state-changing workflows, behind explicit network and credential controls. Keep Chromium available as a fallback while Kitesurf is under heavy development.

Kitesurf's open-source release makes the design inspectable and locally testable. That is enough reason to benchmark it. It is not yet a reason to remove the boring browser path that already works.

## References

- [Cloudflare: Kitesurf is now open source](https://blog.cloudflare.com/kitesurf-open-source/)
- [GitHub: cloudflare/kitesurf](https://github.com/cloudflare/kitesurf)
- [Kitesurf Web Platform Tests dashboard](https://kitesurf.dev/wpt)
- [Kitesurf benchmark dashboard](https://kitesurf.dev/benchmarks)
- [Cloudflare Dynamic Workers pricing](https://developers.cloudflare.com/dynamic-workers/pricing/)
