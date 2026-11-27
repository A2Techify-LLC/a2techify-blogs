---
layout: post
title: "uv 0.13.10 Closes a ZIP Parser Gap: Upgrade Your Python Build Images"
date: 2026-11-27 07:30:00 -0600
categories: [security, engineering]
tags: [security, supply-chain, devtools]
description: "uv 0.13.10 rejects ZIP archives whose size records disagree, closing a parser differential that could hide Python code from other tooling."
image: "/assets/images/posts/uv-zip-parser-security-upgrade.png"
---

Astral released uv 0.13.10 with a security fix for a subtle Python package supply-chain problem: the same ZIP archive could pass the same SHA-256 check, install successfully with both uv and pip, yet produce different file contents.

The affected range is uv 0.1.29 through 0.13.9. Version 0.13.10 rejects ZIP members when the compressed size in the data descriptor disagrees with the size in the central directory.

The advisory rates the issue low severity because exploitation requires an attacker-controlled distribution and PyPI now mitigates malformed ZIP uploads. That does not make the update optional for CI runners, developer images, internal package mirrors, or systems that install from arbitrary URLs and private indexes.

<!--more-->

## What Changed

A ZIP member that uses a data descriptor can record its compressed size in two places:

1. after the member's compressed data; and
2. in the archive's central directory.

Before 0.13.10, uv's streaming extractor and Python's `zipfile` module could behave differently when those values disagreed. uv read to the end of the compressed data, while `zipfile` read the number of bytes declared in the central directory.

An attacker could construct the prefix and the full content with the same CRC32 value. A tool using `zipfile`, including pip's extraction path described by the advisory, could then install the prefix while uv installed the full file. The prefix could appear empty even though uv extracted executable Python code.

Both tools received the same archive bytes, so both could verify the same SHA-256 digest. The failure was not that the archive changed after signing. The failure was that two parsers disagreed about what the authenticated bytes meant.

uv 0.13.10 closes that gap by rejecting the conflicting size records instead of choosing one interpretation.

## Why Hash Verification Was Not Enough

A cryptographic digest answers, "Are these exactly the bytes we expected?" It does not answer, "Will every parser interpret these bytes the same way?"

That distinction matters anywhere a pipeline separates inspection from execution. A scanner may examine an archive with one library while an installer, build backend, or runtime consumes it with another. If malformed input has two valid interpretations, a clean scan and a matching digest can still precede different installed code.

The durable rule is simple: ambiguous archives should fail closed. Package managers should reject contradictory metadata, and security controls should inspect the same representation that will execute whenever practical.

## The Practical Upgrade

First, inventory the uv binary that actually runs in developer shells, CI jobs, containers, and deployment builders:

```bash
uv --version
command -v uv
```

Upgrade every affected installation to at least 0.13.10 using the same managed path that installed it. If a container downloads a pinned release, change the pin rather than adding an untracked update step:

```dockerfile
ARG UV_VERSION=0.13.10
COPY --from=ghcr.io/astral-sh/uv:${UV_VERSION} /uv /uvx /bin/
RUN uv --version
```

Keep the version explicit in production build files. A floating tag makes emergency updates easy to miss in review and makes older builds harder to reproduce.

After updating, run the project's normal locked installation and test suite. For a uv-managed project, a useful CI sequence is:

```bash
uv --version
uv lock --check
uv sync --locked
uv run pytest
```

`uv lock --check` is especially relevant in this release. Version 0.13.10 also improves validation that dependency requirements in `uv.lock` agree with the versions selected by the lockfile, and reports missing package entries more clearly. That is separate from the ZIP vulnerability, but it is another reason to run the lock check rather than treating the file as inert text.

This post does not need an example repository. The fix lives in the installer, and the useful reader action is to pin, inventory, rebuild, and test the existing project. A demonstration archive would reproduce attacker technique without improving the mitigation.

## Exposure And Rollout Notes

The advisory's limits are important:

- A victim must install or build an attacker-controlled distribution.
- For a malicious wheel, installation alone is not enough; concealed code executes when the installed module is later imported or otherwise invoked.
- A ZIP source distribution can be more dangerous because uv may invoke its build backend during dependency resolution or installation.
- PyPI provides ecosystem-level mitigations for malformed ZIPs, reducing exposure through the public index.

Teams can still have meaningful exposure outside that narrow public-index path. Review installs from Git repositories, direct URLs, uploaded build artifacts, private indexes, internal mirrors, and user-supplied plugin packages. A private source is not automatically a trusted source, especially when many people or automation identities can publish to it.

Rebuild long-lived base images and cached CI toolchains after changing the pin. Updating a Dockerfile does not replace already-published images, and updating a workstation package does not change the copy baked into a runner image.

There is no indication in the advisory that existing environments must be destroyed merely because they were built with an affected uv version. Prioritize environments that consumed untrusted or unexpected package sources, review provenance and build logs, and rotate artifacts when their origin cannot be established.

## Cost And Operational Notes

- **The software update is free.** uv is open source; the costs are image rebuilds, cache misses, CI time, and validation.
- **Do not regenerate every lockfile blindly.** Upgrade the installer first, check the existing lock, and review any resolution change as a dependency update.
- **Pin the tool and the inputs.** Record the uv version, base-image digest, index configuration, lockfile, and direct package URLs used for a release build.
- **Treat private indexes as production systems.** Restrict publishing identities, retain immutable artifacts, log uploads, and separate read credentials from publish credentials.
- **Keep scanners close to execution.** An SBOM or archive scan is useful, but it does not replace fail-closed parsing by the installer that consumes the package.
- **Avoid arbitrary package installation in exposed services.** If an application accepts package names or archives from users, isolate that build path and assume package build code is executable.

## What We'd Watch Next

Parser differentials are not unique to Python packaging. Archive tools, signature verifiers, scanners, and runtimes often share bytes but not parsing implementations. We would watch for equivalent hardening in adjacent installers and for guidance from private-index products on malformed artifact rejection.

For teams using uv today, the immediate work is small: find every copy, move it to 0.13.10 or newer, rebuild the images that carry it, and prove a locked install in CI. The larger lesson is worth keeping: a verified hash establishes byte identity, not interpretation identity.

## References

- [Astral: uv 0.13.10 release notes](https://github.com/astral-sh/uv/releases/tag/0.13.10)
- [GitHub Security Advisory GHSA-vjvj-3m3f-fgmm](https://github.com/astral-sh/uv/security/advisories/GHSA-vjvj-3m3f-fgmm)
- [Astral PR: reject conflicting ZIP compressed sizes](https://github.com/astral-sh/uv/pull/23332)
- [Astral PR: validate locked dependency versions](https://github.com/astral-sh/uv/pull/23238)
- [uv documentation: locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/)
