---
layout: post
title: "GitHub's License Data Update Makes SBOM Reviews Less Noisy"
date: 2026-08-17 07:30:00 -0500
categories: [security, devtools]
tags: [github, supply-chain, sbom, security, devtools]
description: "GitHub is prioritizing registry license metadata in the dependency graph, which should make SBOMs and dependency review checks easier to trust."
image: "/assets/images/a2techify-blogs-card.png"
---

GitHub's August 13 dependency graph update is small on the surface and useful in practice: license data now comes first from canonical package registries such as npm, PyPI, crates.io, NuGet, Rubygems, pkg.go.dev, deps.dev, pub.dev, and Packagist.

That matters because license checks are only helpful when the signal is stable enough to act on. If an SBOM or pull request review reports too many missing or confusing licenses, teams either over-investigate every dependency change or quietly stop trusting the control.

<!--more-->

## What Changed

GitHub says the dependency graph now prioritizes license metadata from package registries instead of treating ClearlyDefined as the primary source. GitHub still uses and contributes to ClearlyDefined, but registry data now gets first position, with ClearlyDefined as a fallback.

The early result GitHub reported is meaningful: missing licenses dropped from 45% of the 170 million packages in the dependency graph to 24%. GitHub also changed the system to track license history by version ranges, instead of requiring a separate database entry for every package version.

That version-range detail is the part operators should notice. GitHub used Grafana as the example: older Grafana versions can map to Apache-2.0 while newer versions map to AGPLv3. For compliance checks, that is better than pretending a package has one timeless license or marking too many versions unknown.

## Why It Matters

Most teams do not fail at software supply chain work because they lack a scanner. They fail because the scanner output creates more ambiguity than the team can process.

Better license coverage helps in three places:

- dependency insights, where engineers inspect what a repository actually uses;
- exported SBOMs, where licenses need to be understandable outside GitHub;
- dependency review in pull requests, where teams can block or flag risky dependency changes before merge.

This is especially useful for small teams. A lightweight policy such as "allow permissive licenses, review copyleft, block unknown licenses only for production runtime dependencies" is hard to operate when nearly half the graph is unknown. It becomes more realistic when the metadata is cleaner and tied to version ranges.

## How It Works

GitHub's dependency graph reads manifests and lock files, then records dependency names, versions, ecosystems, license information, manifest paths, vulnerability status, and transitive paths where supported. GitHub can also ingest submitted dependency data from build systems and package managers it cannot infer from checked-in files alone.

For SBOM export, GitHub uses the dependency graph to produce an SPDX file. The SBOM includes dependency inventory details such as versions, package identifiers, licenses, transitive paths, and copyright information.

For pull requests, the dependency review action compares dependency changes against the base branch. It can report vulnerabilities and license issues, and it supports license allowlists for teams that want CI to fail on dependencies outside an approved set.

The practical change is not a new workflow. It is better input data for workflows many teams already have.

## A Small Useful Check

This post does not need a sample repo. The useful move is to make license review visible in repositories that already ship software.

For a public GitHub repository, a minimal dependency review workflow looks like this:

```yaml
name: Dependency Review

on:
  pull_request:

permissions:
  contents: read

jobs:
  dependency-review:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v6

      - name: Dependency review
        uses: actions/dependency-review-action@v5
        with:
          fail-on-severity: moderate
          license-check: true
          allow-licenses: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC
```

Start with this as a reporting control before making it a hard gate across every repository. If the team already has dependencies with LGPL, MPL, EPL, AGPL, GPL, custom commercial terms, or unknown licenses, write down the decision instead of hiding it in a failed CI run.

For an existing repository, also export the SBOM from GitHub's dependency graph and inspect a few high-impact dependencies:

```bash
# GitHub UI path:
# Repository -> Insights -> Dependency graph -> Export SBOM
```

Check whether the packages your team cares about now show clearer license data. Pay special attention to runtime dependencies, shipped binaries, container images, SDKs embedded in products, and packages that changed license terms across versions.

## Cost And Operational Notes

The dependency graph and SBOM export are available from GitHub's repository security surface. The dependency review action is available for public repositories, and for private organization-owned repositories when the organization has GitHub Advanced Security.

There are still limits:

- registry metadata can be wrong, stale, incomplete, or changed by package maintainers;
- license fields are not a substitute for reviewing full license text when the decision matters;
- generated, vendored, private, or build-submitted dependencies may need extra dependency submission work;
- SBOMs describe inventory, not whether the organization is complying with a license;
- CI policy should distinguish runtime dependencies from dev-only tools where possible.

The main operating advice is boring but valuable: keep the policy explicit. Decide which licenses are automatically allowed, which require review, which are blocked, and who owns exceptions.

## What We'd Watch Next

Cleaner license metadata should make dependency review more useful, but the next practical layer is exception management. Teams need a simple way to say: this dependency is approved for this repository, in this scope, for this product, under this reason, until this date.

Without that, license governance becomes scattered across CI YAML, issue comments, spreadsheets, and memory. Better graph data is a strong input. The durable workflow still needs ownership, review notes, and periodic cleanup.

## References

- [GitHub Changelog: License data quality improvements](https://github.blog/changelog/2026-08-13-license-data-quality-improvements/)
- [GitHub Docs: Dependency graph](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-graph)
- [GitHub Docs: Exporting a software bill of materials for your repository](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/establish-provenance-and-integrity/export-dependencies-as-sbom)
- [GitHub: actions/dependency-review-action](https://github.com/actions/dependency-review-action)
