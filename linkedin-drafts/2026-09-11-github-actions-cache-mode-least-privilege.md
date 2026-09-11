# GitHub Actions Cache Mode Makes CI Caches Less Trusting

LinkedIn newsletter draft for A2Techify Field Notes.

Source post: https://blogs.a2techify.com/2026/09/11/github-actions-cache-mode-least-privilege/
LinkedIn URL: TODO after publishing

## Newsletter Title

GitHub Actions Cache Mode Makes CI Caches Less Trusting

## Intro

GitHub Actions cache-mode is now generally available, giving workflows and jobs explicit read, write, write-only, or no-cache access so teams can reduce cache-poisoning risk.

## Takeaways

- cache-mode is a new GitHub Actions workflow syntax key for controlling cache access at the workflow level, the job level, or both. Job-level settings override workflow-level settings.
- Most teams already know to be careful with secrets in Actions.
- jobs: test: runs-on: ubuntu-latest steps: uses: actions/checkout@v6 uses: actions/cache@v4 with: path: ~/.npm key: npm-<package-lock-hash run: npm ci run: npm test
- The next thing to watch is how setup actions expose and document cache behavior.

## CTA

Read the full note: https://blogs.a2techify.com/2026/09/11/github-actions-cache-mode-least-privilege/

## Publishing Notes

- Publish manually from the A2Techify LinkedIn Page newsletter editor.
- After publishing, add the LinkedIn newsletter URL to the source post front matter as `linkedin_url`.
- Keep the blog post as the canonical article.

Topics: github, security, ci
