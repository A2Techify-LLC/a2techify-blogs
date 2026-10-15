---
layout: post
title: "GitHub AI Scan Expands Pull Request Security Coverage, but It Won't Block Merges"
date: 2026-10-15 18:15:00 -0500
categories: [security, engineering]
tags: [github, security, devtools]
description: "GitHub AI Scan now checks pull request changes in PHP, Bash, Terraform, Dockerfiles, and other gaps in CodeQL coverage, with advisory findings and separate AI-credit billing."
image: "/assets/images/posts/github-ai-scan-pull-requests.png"
---

GitHub has made AI Scan for pull requests generally available. The feature looks for vulnerabilities in changed code that CodeQL does not currently cover well, including PHP, Shell/Bash, Terraform configuration, Dockerfiles, JSP, and Blazor.

The useful part is broader coverage without adding another scanner or build step. The important limitation is just as clear: these findings are advisory. They cannot fail the code scanning check or block a merge.

<!--more-->

## What Changed

AI Scan now runs automatically on qualifying pull requests when code scanning and the repository's effective AI Scan setting are enabled. It runs when a pull request is opened and again after new commits.

Findings appear beside CodeQL results on the **Conversation** and **Files changed** tabs, marked with an **AI** indicator. A finding includes an explanation of the risk and usually a suggested remediation. Copilot Autofix may also offer a code change when one is available.

GitHub lists current detection categories including injection, weak cryptography, broken access control, sensitive-data exposure, security misconfiguration, authentication failures, unsafe deserialization and other integrity failures, server-side request forgery, and supply-chain risks.

This is pull-request analysis only. AI Scan does not create a repository-wide backlog of findings in the security view.

## Why We're Paying Attention

Static analysis coverage often stops at a language boundary. A team may have strong CodeQL checks for application code while Terraform, deployment scripts, Dockerfiles, and framework-specific files receive mostly manual review.

AI Scan is aimed directly at that gap. It can inspect changed code without a build configuration and may use repository code search to gather context before reporting an issue.

That makes it useful as a second reviewer for changes such as:

- a shell command assembled from user-controlled input;
- an unpinned action, package, or container image;
- a Terraform rule that exposes a service too broadly;
- a Dockerfile that downloads and executes an artifact without integrity checks;
- a PHP handler that builds SQL or HTML unsafely.

The feature should complement deterministic scanning and human review, not replace either one. GitHub explicitly warns that AI findings can include false positives.

## How The Pull Request Flow Works

AI Scan runs only when all of these conditions are true:

1. Code scanning is enabled for the repository.
2. AI Scan for pull requests is enabled by the effective organization or repository setting.
3. The pull request is not from a fork and was not created by Dependabot.
4. The change includes a supported language or framework outside CodeQL's current coverage.

AI Scan does not depend on CodeQL default setup. If CodeQL is waiting or fails, the AI scan can still run.

There is also a policy boundary worth noting. Enterprise owners must first allow organizations to enable AI Scan; the enterprise policy defaults to **Not allowed**. Organization owners or security managers can then enable it for eligible repositories, and repository administrators can opt out. Public repositories owned by personal accounts can manage the toggle directly.

## A Small, Useful Evaluation

This post does not need a sample repository. The useful test is a controlled pull request in an existing eligible repository, because the result depends on GitHub's hosted scanning service and account settings.

Use a non-production branch and make one small change in a language AI Scan supports. A safe evaluation plan is:

```text
1. Confirm code scanning is enabled.
2. Confirm the effective AI Scan setting in Security coverage.
3. Set or review the Code Security AI Credits budget.
4. Open a small pull request with representative Terraform, Bash,
   Dockerfile, PHP, JSP, or Blazor changes.
5. Compare AI findings with human review and existing scanners.
6. Record false positives, missed issues, scan latency, and credit use.
```

Do not seed a real vulnerability in a production repository just to prove the feature works. A disposable branch or intentionally vulnerable test fixture is enough.

For every finding, ask four questions:

- Is the reported data flow real in this repository?
- Does the proposed fix preserve behavior?
- Would an existing deterministic rule catch the same issue more reliably?
- Should this class of issue become a required check elsewhere, since AI Scan itself cannot block the merge?

That last question matters. If the trial uncovers a repeatable risk, turn the lesson into a CodeQL query, linter rule, policy-as-code check, test, or review checklist that can enforce the requirement.

## Cost And Operational Notes

Availability and billing are separate decisions.

AI Scan is available for public repositories owned by organizations or personal accounts. Private and internal organization repositories require GitHub Code Security or GitHub Advanced Security. Private repositories in a personal namespace are not supported. A GitHub Copilot license is not required.

Every qualifying scan consumes **Code Security AI Credits**, including scans of public repositories that do not require an active-committer license. Included credits from a Copilot entitlement are used first; after that, usage is metered. GitHub supports SKU-level budgets, and a hard budget can stop new findings when no credits remain.

Broad enablement can start consuming credits immediately on eligible repositories where code scanning is already enabled. Before switching it on for an organization:

- review which repositories are eligible;
- check included credits and who owns the bill;
- set a hard budget or alert for Code Security AI Credits;
- choose a small initial repository set when possible;
- monitor the **AI usage** billing view and the AI Scan security overview reports;
- define who triages findings and how false positives are handled.

The operational gap is enforcement. Since AI Scan findings cannot satisfy a ruleset requirement or fail the code scanning check, teams still need a review policy for unresolved high-confidence findings.

## What We'd Watch Next

The next useful step would be a promotion path from a confirmed AI finding to a deterministic, enforceable rule. Advisory discovery is helpful, but security teams get more leverage when a repeated lesson becomes a check that is cheap, explainable, and merge-blocking.

We would also watch credit consumption per repository and per accepted finding. A scanner can be technically capable and still be a poor operational fit if noisy results consume review time or metered credits faster than they prevent defects.

For now, AI Scan is best treated as a coverage-expansion experiment: enable it deliberately, budget it explicitly, and convert its strongest recurring findings into controls the build can enforce.

## References

- [GitHub Changelog: AI Scan for pull requests generally available](https://github.blog/changelog/2026-10-15-ai-scan-for-pull-requests-generally-available/)
- [GitHub Docs: AI Scan for pull requests](https://docs.github.com/en/enterprise-cloud@latest/code-security/concepts/code-scanning/ai-powered-security-detections)
- [GitHub Docs: GitHub Advanced Security license billing](https://docs.github.com/en/billing/concepts/product-billing/github-advanced-security#how-ai-feature-usage-is-billed)
- [GitHub Docs: GitHub security features](https://docs.github.com/en/code-security/getting-started/github-security-features)
