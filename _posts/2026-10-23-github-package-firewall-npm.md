---
layout: post
title: "GitHub's Package Firewall Adds an Install-Time Gate for npm"
date: 2026-10-23 12:43:00 -0500
categories: [security, engineering]
tags: [github, security, supply-chain]
description: "GitHub's package firewall can hold back new npm releases, block known malware and vulnerabilities, and flag supply-chain regressions before agents or CI install them."
image: "/assets/images/posts/github-package-firewall-npm.png"
---

GitHub has put a package firewall into public preview for Enterprise Cloud customers. It sits between npm clients and the public registry, evaluating package metadata and downloads before a developer machine, CI runner, or coding agent installs them.

The useful change is the timing. Dependabot and lockfile scanners find risk in repository state; this firewall can stop a package at installation time, including a version that was published too recently to have much security history.

<!--more-->

## What Changed

Enterprise administrators can now route npm traffic through a GitHub-hosted registry endpoint and apply one policy across participating endpoints. The available controls are:

- block package versions covered by active malware advisories;
- block vulnerabilities at a chosen minimum severity;
- block an attestation downgrade when an earlier version had SLSA provenance but the requested version does not;
- block versions that newly introduce `preinstall`, `install`, or `postinstall` behavior;
- require a minimum package age from 1 to 365 days, or disable the cooldown with a value of 0.

GitHub enables malware checks, attestation-downgrade checks, and newly introduced install-script checks by default. Vulnerability blocking defaults to critical severity, and the package-age cooldown defaults to one day.

The service evaluates metadata requests as well as package downloads. That matters because an npm client needs registry metadata before it resolves a version; filtering only the final tarball would leave part of the dependency-resolution path outside the policy gate.

## Why We're Paying Attention

Automated environments install dependencies quickly and often. A coding agent may create a temporary workspace and run `npm install` without a person inspecting every transitive version. CI runners do the same on every clean build. If a malicious package or compromised release is available upstream, a lockfile update or loose version range can bring it into an environment that holds source code, repository tokens, cloud credentials, or deployment access.

A cooldown changes that race. Instead of accepting a release immediately, a team can wait long enough for maintainers, registries, researchers, and advisory feeds to react. It is not proof that an older package is safe, but it removes the assumption that the newest matching version should always be trusted first.

The other checks cover signals that a conventional vulnerability threshold can miss. A package can be dangerous because it suddenly gained an install script or lost provenance, even when it has no published CVE yet.

## How The Request Path Works

The endpoint no longer points directly at `registry.npmjs.org`. It uses an enterprise-specific GitHub package-firewall URL and sends a GitHub token with each request:

```text
npm or agent
    |
    v
GitHub package firewall
    |-- package age policy
    |-- malware and vulnerability advisories
    |-- attestation downgrade check
    |-- newly introduced install-script check
    |
    +--> allow: fetch from npm and return the package
    +--> block: return an error and an exception-request URL
```

The token must belong to a user or bot that is a member of the enterprise. GitHub says it needs no elevated permission beyond read-only access to public repositories. It should still be treated as a secret and scoped to the environment that needs it.

Organizations already using Artifactory can place the firewall behind an Artifactory remote repository, then expose that remote through a virtual npm repository. GitHub marks Artifactory support as experimental in the preview.

## A Small, Useful Trial

This feature does not need a sample repository. The meaningful test depends on an Enterprise Cloud policy and real package-manager routing, so a disposable CI workflow or isolated development container is more useful than another wrapper project.

After an enterprise administrator configures the policy, point a test environment at the firewall. Replace `ENTERPRISE` with the enterprise slug:

```ini
# User-level .npmrc in the isolated test environment
registry=https://package-firewall.githubapp.com/npm/enterprises/ENTERPRISE
//package-firewall.githubapp.com/npm/enterprises/ENTERPRISE/:_authToken=${GITHUB_TOKEN}
```

Do not commit a token or a generated `.npmrc` containing one. In CI, inject `GITHUB_TOKEN` through the platform's secret store.

Run a frozen install against a representative lockfile:

```bash
npm ci --ignore-scripts=false
```

Then evaluate more than whether the command passed:

```text
1. Did every public npm request use the firewall endpoint?
2. Which direct or transitive versions were blocked, and by which policy?
3. Did the package-age setting delay urgent security updates?
4. Does the exception link identify the package and version clearly?
5. Who can approve an exception, and how quickly can they respond?
6. Can a project-level .npmrc or alternate client bypass the route?
```

Test the failure path with a known benign package version that is younger than the configured cooldown, if one is available. Avoid downloading known malware merely to prove that malware blocking works. The policy result and audit trail are the useful evidence.

## Exceptions Are Part Of The Design

When a package is blocked, npm output can include a URL for requesting an override. Enterprise administrators and enterprise security managers review those requests. Approved package-and-version ranges become policy exceptions and can be removed later.

This is necessary because a blanket cooldown can also hold back a legitimate emergency fix. The operational quality of the firewall will depend on exception discipline:

- require the requester to explain why waiting is riskier than installing;
- prefer a specific version or narrow range over `*`;
- record who reviewed the package and what evidence they checked;
- expire or revisit exceptions instead of treating them as permanent allowlists;
- monitor broad exceptions for packages that publish frequently.

A bypass workflow without ownership will become either a deployment bottleneck or a collection of permanent holes.

## Cost And Operational Notes

The public preview is available to GitHub Enterprise Cloud customers, including customers using data residency. GitHub says it is free during preview. At general availability, the company plans metered usage similar to GitHub Actions billing; final pricing is not yet stated in the release note.

There are several current constraints:

- **npm only.** PyPI, Maven, NuGet, RubyGems, container registries, and other ecosystems are not supported today.
- **Enterprise Cloud required.** This is not a free control for individual GitHub accounts or ordinary organization plans.
- **Routing must be enforced.** A firewall protects only requests that actually pass through it. Audit `.npmrc` precedence, alternate registry settings, build images, proxies, and agent sandboxes.
- **Tokens still need lifecycle management.** Use a dedicated bot where appropriate, store its token in a secret manager, rotate it, and avoid exposing it in logs.
- **Availability becomes a build dependency.** A firewall or network outage can stop clean installs, so decide how CI should fail and whether an approved internal cache is part of the design.
- **Preview behavior can change.** Pin the rollout to a small group first and review GitHub's documentation before broad enforcement.

The firewall should complement lockfiles, `npm ci`, dependency review, artifact attestations, least-privilege CI credentials, and isolated build environments. It does not inspect application behavior after installation, and it cannot guarantee that an allowed package is benign.

## What We'd Watch Next

The first question is whether GitHub adds other ecosystems. Python package installation and container-image pulls create the same unattended risk for agents and CI, but they currently remain outside this service.

We would also watch the false-positive rate for newly introduced install scripts and attestation downgrades. Those are valuable behavioral signals, but teams need enough context to distinguish a suspicious regression from an intentional packaging change.

Finally, pricing at general availability will determine where the firewall fits. A clear per-request or per-download model, usable audit data, and controls that prevent accidental bypass will matter as much as the detection rules.

For npm-heavy Enterprise Cloud teams, this is worth a contained trial now. Start with CI or agent sandboxes, use a short cooldown, rehearse one exception, and verify that direct access to the public registry cannot silently bypass the policy.

## References

- [GitHub Changelog: GitHub package firewall in public preview](https://github.blog/changelog/2026-10-20-github-package-firewall-in-public-preview/)
- [GitHub Docs: Protecting endpoints with GitHub package firewall](https://docs.github.com/en/enterprise-cloud@latest/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/protecting-endpoints-with-package-firewall)
- [GitHub Advisory Database](https://github.com/advisories)
- [npm documentation: Dependency selectors and npm install](https://docs.npmjs.com/cli/v11/commands/npm-install/)

