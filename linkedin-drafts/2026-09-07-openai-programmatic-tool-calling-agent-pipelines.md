# Programmatic Tool Calling Makes Agent Pipelines Smaller

LinkedIn newsletter draft for A2Techify Field Notes.

Source post: https://blogs.a2techify.com/2026/09/07/openai-programmatic-tool-calling-agent-pipelines/
LinkedIn URL: TODO after publishing

## Newsletter Title

Programmatic Tool Calling Makes Agent Pipelines Smaller

## Intro

OpenAI's Programmatic Tool Calling lets a model write bounded JavaScript to coordinate tools, which can shrink agent loops when the workflow is predictable and the boundary is clear.

## Takeaways

- OpenAI says GPT-5.6 can write and run lightweight programs that coordinate tools, process intermediate results, monitor progress, and choose the next action as work unfolds.
- The model calls a search tool.
- The application decides which tools the model may call directly and which tools generated JavaScript may call. That distinction matters.
- Teams will need traces that show the generated program, tool calls, arguments, returned structured data, limits hit, approvals requested, and final reduced payload.

## CTA

Read the full note: https://blogs.a2techify.com/2026/09/07/openai-programmatic-tool-calling-agent-pipelines/

## Publishing Notes

- Publish manually from the A2Techify LinkedIn Page newsletter editor.
- After publishing, add the LinkedIn newsletter URL to the source post front matter as `linkedin_url`.
- Keep the blog post as the canonical article.

Topics: agents, tool-calling, devtools
