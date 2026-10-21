# llama.cpp v0.7.0 Adds a GPU Cache for CPU-Offloaded MoE Experts

LinkedIn newsletter draft for A2Techify Field Notes.

Source post: https://blogs.a2techify.com/ai/engineering/2026/10/21/llama-cpp-moe-gpu-cache.html
LinkedIn URL: TODO after publishing

## Newsletter Title

llama.cpp v0.7.0 Adds a GPU Cache for CPU-Offloaded MoE Experts

## Intro

llama.cpp v0.7.0 can cache frequently used MoE experts on the GPU while keeping the full expert set in system memory.

## Takeaways

- The v0.7.0 release introduces a GPU cache specifically for MoE experts that remain in host memory. It works with llama.cpp's existing CPU-offload controls:
- Sparse MoE models reduce the compute used for each token by activating only a subset of their experts.
- The first useful community data will be cache-size curves across different MoE families and hardware links, not isolated peak numbers.

## CTA

Read the full note: https://blogs.a2techify.com/ai/engineering/2026/10/21/llama-cpp-moe-gpu-cache.html

## Publishing Notes

- Publish manually from the A2Techify LinkedIn Page newsletter editor.
- After publishing, add the LinkedIn newsletter URL to the source post front matter as `linkedin_url`.
- Keep the blog post as the canonical article.

Topics: local-ai, quantization, gpu-management
