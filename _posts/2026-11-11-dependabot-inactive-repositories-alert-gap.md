---
layout: post
title: "Dependabot Will Pause Alerts on Inactive Repositories: Audit Before December 8"
date: 2026-11-11 22:39:00 -0600
categories: [security, engineering]
tags: [github, security, supply-chain]
description: "GitHub will pause Dependabot alerts on many repositories after one year without activity. Here is how to find the candidates, preserve coverage, and avoid fake keepalive commits."
image: "/assets/images/posts/dependabot-inactive-repositories-alert-gap.png"
---

GitHub is changing a quiet assumption in dependency security. Starting December 8, 2026, it will turn off Dependabot alerts on most repositories that have had no activity for one year.

Existing alerts will be archived rather than deleted, and turning alerts back on restores them. The operational risk is still real: a repository can remain deployed, embedded in a build, or available for reuse even when nobody has pushed to it recently.

<!--more-->

## What Changed

For this policy, GitHub counts three events:

- pushing to any branch or tag;
- creating the repository; or
- turning on Dependabot alerts.

Issue comments, pull-request reviews, releases without a new tag push, and repository traffic are not listed as activity signals in GitHub's announcement. Do not assume that a repository is protected because people still discuss or download it.

The change applies to all plans on GitHub.com and to GitHub Enterprise Cloud with data residency. It does not apply to GitHub Enterprise Server.

## Why Inactive Does Not Mean Irrelevant

A one-year push gap is a useful maintenance signal, but it is not a complete risk classification. Long-lived libraries, deployment templates, firmware, container build contexts, and disaster-recovery tools may be intentionally stable. Some are consumed from a package registry or copied into downstream builds without regular commits to the source repository.

Treat the new policy as an inventory deadline. Each inactive repository should end in one of three states:

1. **Retire it:** archive the repository and remove or replace its production consumers.
2. **Keep it monitored:** preserve Dependabot coverage because the code is still distributed, deployed, or likely to be reused.
3. **Accept the pause:** document why dependency alerts no longer provide useful risk reduction.

That decision belongs with the repository's actual owner, not with an automated keepalive job.

## Find The Repositories Near The Cutoff

This read-only GitHub CLI query lists organization repositories whose most recent push is older than one year. Replace `ORG` and review the cutoff date when you run it:

```bash
gh api --method GET --paginate "orgs/ORG/repos" \
  -f per_page=100 \
  --jq '.[] | select(.archived == false and .pushed_at < "2025-12-08T00:00:00Z") | [.full_name, .visibility, .pushed_at] | @tsv'
```

This is a candidate list, not proof that alerts will be disabled. GitHub documents exceptions for repositories covered by an enforced security configuration that enables Dependabot alerts, and for enterprises whose policy prevents repository administrators from changing Dependabot alert state.

Export the current open-alert inventory before the change as a second, read-only baseline:

```bash
gh api --method GET --paginate "orgs/ORG/dependabot/alerts" \
  -f state=open \
  -f per_page=100 \
  --jq '.[] | [.repository.full_name, .security_advisory.ghsa_id, .security_advisory.severity, .dependency.package.name] | @tsv' \
  > dependabot-open-alerts-2026-12-07.tsv
```

The organization alerts endpoint requires an organization owner or security manager. Token permissions also matter; GitHub's REST documentation lists the required scopes and notes that Dependabot alert management through the API is in public preview.

## Preserve Coverage Without Fake Commits

Do not add an empty annual commit just to reset the clock. It changes repository history without improving ownership, patchability, or deployment safety.

For an individual repository, an administrator can enable Dependabot alerts under **Settings → Advanced Security**. At organization scale, an enforced security configuration is the stronger control: GitHub says repositories with an enforced configuration that enables Dependabot alerts are excluded from the inactivity pause.

For each repository kept under monitoring, record:

- the service, package, image, or workflow that still consumes it;
- the person or team responsible for triage;
- whether dependency manifests and lockfiles are present and current;
- how a fix would be tested and released; and
- the planned retirement or review date.

Alerts without an owner and a release path are inventory, not a security process.

## Cost And Operational Notes

Dependabot alerts are available for repositories on GitHub.com, and the inventory commands above use the GitHub API rather than a paid external service. The main costs are operational.

- **API limits:** large organizations need pagination and should avoid repeatedly scanning every repository. Save a dated result and compare deltas.
- **Permissions:** use the least-privileged credential that can read the required organization and security data. Do not place tokens in scripts or committed files.
- **Private repository data:** the export contains repository names and vulnerability details. Store it with the same care as other security findings.
- **Exception management:** an enforced configuration prevents accidental drift, but it also creates an explicit organization-wide commitment to process alerts.
- **Archived alerts:** GitHub says re-enabling restores archived alerts. Verify the repository's alert state after restoration instead of assuming a push alone repaired the workflow.

No new sample repository is needed for this change. The useful artifact is a reviewed inventory tied to ownership and policy; another wrapper around `gh api` would add maintenance without improving the decision.

## What We'd Watch Next

Run the candidate query, join the result with deployment and package ownership data, and review the smallest high-risk set first: internet-facing services, reusable libraries, build infrastructure, and repositories that produce deployed images or artifacts.

Then enforce Dependabot alerts for repositories that remain operational, retire the ones that do not, and keep a dated baseline of open alerts. The deadline is not a reason to manufacture activity. It is a reason to make stale repository risk visible and assign it to someone who can act.

## References

- [GitHub Changelog: Dependabot alerts will pause on inactive repositories](https://github.blog/changelog/2026-11-10-dependabot-alerts-will-pause-on-inactive-repositories/)
- [GitHub Docs: Configuring Dependabot alerts](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-dependabot-alerts)
- [GitHub Docs: Creating a custom security configuration](https://docs.github.com/en/code-security/how-tos/secure-at-scale/configure-organization-security/establish-complete-coverage/create-custom-configuration)
- [GitHub REST API: List organization repositories](https://docs.github.com/en/rest/repos/repos#list-organization-repositories)
- [GitHub REST API: List Dependabot alerts for an organization](https://docs.github.com/en/rest/dependabot/alerts#list-dependabot-alerts-for-an-organization)
