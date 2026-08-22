---
layout: post
title: "Docker Sandboxes Put CI Agents Behind a Smaller Boundary"
date: 2026-08-22 07:30:00 -0500
categories: [security, engineering]
tags: [agents, docker, github, ci, security]
description: "Docker's GitHub Agentic Workflows integration gives coding agents a microVM sandbox with a private Docker daemon, making CI automation more useful without handing it the whole runner."
image: "/assets/images/posts/docker-sandboxes-agent-ci-blast-radius.png"
---

Docker published a useful example of AI agents running inside GitHub Actions with Docker Sandboxes. The important part is not that an agent can edit code from CI. Teams are already moving in that direction.

The important part is the boundary: the agent gets a disposable microVM with its own kernel, filesystem, network stack, and private Docker daemon. That lets it run real build and integration-test workflows while keeping the GitHub runner, host Docker daemon, network, and pull-request output surface much narrower.

<!--more-->

## What Changed

GitHub Agentic Workflows, the `gh-aw` GitHub CLI extension, added Docker Sandboxes as a supported agent runtime in July 2026. Docker's August 21 post shows that runtime in a small Java example where an agent:

- runs in a GitHub-hosted `ubuntu-24.04` Actions job;
- enters a Docker Sandbox through the `docker-sbx` runtime;
- runs a Java 21 integration test suite with PostgreSQL through Testcontainers;
- finds a seeded case-sensitivity bug;
- makes the smallest source fix;
- opens a draft pull request with only allowed source files changed.

That is the shape worth paying attention to. The agent is powerful where it needs to be powerful, but the workflow still uses explicit GitHub token permissions, network allowlists, and safe-output rules.

## Why We're Paying Attention

Useful coding agents need more than read-only repository access. They install packages, run shell commands, execute tests, start databases, inspect failures, and sometimes need Docker-in-Docker-style workflows to reproduce the same checks a developer runs locally.

The risky version is giving that agent broad access to a normal CI runner and hoping prompt guardrails are enough. A compromised dependency script, malicious test fixture, or confused agent command can turn "run the test suite" into "touch everything the runner can reach."

Docker Sandboxes gives teams a better split:

- broad shell and root-like freedom inside a disposable sandbox;
- a private Docker daemon for Testcontainers and local service dependencies;
- network access defined by policy instead of open Internet by habit;
- source-control output routed through a constrained PR step;
- normal GitHub Actions logs and review flow around the result.

It does not make agent CI automatically safe. It gives the security model a real place to live.

## How It Works

GitHub Agentic Workflows starts from a Markdown workflow file. The YAML front matter declares the runtime and permissions, and the Markdown body gives the agent its task. `gh aw compile` turns that source into a generated GitHub Actions workflow.

The Docker example selects the sandbox runtime with a block like this:

```yaml
runs-on: ubuntu-24.04

permissions:
  contents: read
  copilot-requests: write

engine: copilot

network:
  allowed:
    - defaults
    - github
    - containers
    - java

sandbox:
  agent:
    id: awf
    runtime: docker-sbx
    sudo: true

safe-outputs:
  create-pull-request:
    draft: true
    protected-files: blocked
    allowed-files:
      - "src/**"
```

The key design choice is that `sudo: true` is not the same as unrestricted runner access. Inside the sandbox, the agent can build, run Docker, and launch PostgreSQL for integration tests. Outside it, the workflow keeps repository permissions and output paths small.

## A Small Useful Test

This post does not need a new sample repo. The useful exercise is to inspect an agent CI workflow you already have, or one you are considering, and write down the boundaries before the agent runs.

Start with this checklist:

```text
Agent CI boundary check

1. What exact repository permissions does the job receive?
2. Can the agent reach the host Docker daemon, or only a private daemon?
3. Which network destinations are allowed during the task?
4. Which files can the final PR or patch modify?
5. Are dependency manifests, workflow files, and scripts protected by default?
6. Does the job need secrets, or can it run with repository read plus agent entitlement?
7. Is the result a draft PR that still expects human review?
```

If you cannot answer those seven questions, do not start by adding more prompt instructions. Start by shrinking the runtime, token, network, and output surfaces.

## Cost And Operational Notes

Docker's example uses GitHub-hosted Actions, GitHub Agentic Workflows, Copilot agent execution, and Docker Sandbox authentication. It also requires Docker credentials for the sandbox template pull. That is not a pure local-only setup, and teams should treat it as CI infrastructure rather than a throwaway script.

Operationally, watch for three things:

- **Runner support:** GitHub-hosted `ubuntu-24.04` works in Docker's sample. Self-hosted runners need the right Linux, Docker, KVM, and system access for Docker Sandboxes.
- **Secrets:** GitHub's Actions security guidance still applies. Use least-privilege `GITHUB_TOKEN` permissions, avoid plaintext secrets in workflows, rotate anything exposed, and be careful with privileged triggers such as `pull_request_target`.
- **Generated workflows:** `gh-aw` compiles Markdown workflow sources into `.lock.yml` GitHub Actions files. Review source changes, commit generated files intentionally, and avoid hand-editing generated output.

For small teams, the first production use should be narrow: one repository, one manual workflow, one class of task, a draft PR, and a clear allowlist of files the agent may change.

## What We'd Watch Next

The next useful evolution is policy portability. Teams should be able to express the same boundaries for agents on a laptop, in CI, and in an internal runner: network destinations, filesystem access, Docker access, MCP/tool access, secret exposure, and output paths.

That is where agent platforms become easier to operate. The team should not need one mental model for local coding agents, another for CI agents, and a third for production automation. Docker Sandboxes is interesting because it moves the conversation away from "do we trust the agent?" and toward "what can this agent touch during this one job?"

That is a much better question.

## References

- [Docker Blog: Running AI agents in GitHub Actions with Docker Sandboxes](https://www.docker.com/blog/running-ai-agents-in-github-actions-with-docker-sandboxes/)
- [GitHub: Agent runtimes reference for GitHub Agentic Workflows](https://github.github.com/gh-aw/reference/agent-runtimes/#docker-sbx)
- [GitHub Docs: Secure use reference for GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use)
- [Docker sample repository: docker-sandbox-gh-aw-demo](https://github.com/shelajev/docker-sandbox-gh-aw-demo)
