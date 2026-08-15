---
layout: post
title: "MCP Traffic Detection Makes Agent Tooling Safer to Operate"
date: 2026-08-15 07:30:00 -0500
categories: [ai, security]
tags: [mcp, agents, cloudflare, security, devtools]
sample_repo: "https://github.com/A2Techify-LLC/mcp-traffic-guard-lab"
---

Cloudflare published a practical August 14 update on detecting and securing Model Context Protocol traffic. The useful shift is simple: security teams should not rely only on MCP-looking URLs such as `/mcp` or `/sse`. Modern MCP-over-HTTP traffic carries protocol signals that gateways, proxies, and server middleware can use to identify agent tool calls more reliably.

That matters because MCP makes it easy for agents to call SaaS tools, internal APIs, databases, and operational systems through a common protocol. A tool call can read sensitive data or trigger a write action at machine speed. Once agents have real permissions, visibility and approved-path controls become part of the engineering work, not just a corporate security add-on.

<!--more-->

## What Happened

Cloudflare announced new Cloudflare One capabilities to identify inspected MCP traffic, show which users and servers are generating it, and control direct connections on managed network paths. The post frames the problem around two related risks:

- shadow MCP, where a user connects an agent directly to an unapproved MCP server;
- portal bypass, where a user connects directly to an approved server's upstream URL instead of going through the organization's approved portal.

The announcement also explains why URL matching is weak. MCP does not require a server to live at `/mcp`, and older URL heuristics can miss real MCP traffic or catch unrelated services. Cloudflare points instead to protocol-level signals such as `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name`, and the JSON-RPC request body.

## Why It Matters

Agent tool use changes the risk profile of normal permissions. A human with database or deployment access still makes one decision at a time. An agent can repeatedly call tools, pass large arguments, and chain actions together without the same natural friction.

MCP is not the problem. It is a useful standard for connecting agents to tools. The operational gap is that many teams are adopting MCP clients faster than they are inventorying servers, classifying tools, or deciding which paths are approved.

For builders, the important lesson is to design MCP access like any other production interface:

- know which servers are approved;
- expose the smallest practical tool catalog;
- log tool names and destinations;
- block direct connections where a portal or broker is required;
- keep server-side authorization in front of write tools.

## How The Technology Works

MCP messages use JSON-RPC. In Streamable HTTP transport, clients send JSON-RPC messages to an HTTP endpoint. The MCP 2025-06-18 transport specification says HTTP clients must include `MCP-Protocol-Version` on subsequent requests after initialization, and servers should treat missing version information as backwards compatibility rather than proof that the request is not MCP.

Cloudflare's post explains that newer stateless protocol work adds more visible request metadata. A request can carry `Mcp-Method: tools/call` and `Mcp-Name: get_weather` headers, while the JSON-RPC body also contains `method: "tools/call"` and `params.name`.

That gives defenders three places to act:

- inside the MCP client, before the request leaves the device;
- at the network boundary, where inspected HTTP traffic can be classified and routed;
- at the MCP server, before a tool handler reads data or performs a write.

Each layer sees a different slice. Client hooks can catch local `stdio` servers. A network gateway has the broadest view of remote traffic on managed devices. The server has the richest execution context and should still decide whether a caller may run a specific tool.

## Practical Example

Today's companion repo is:

[A2Techify-LLC/mcp-traffic-guard-lab](https://github.com/A2Techify-LLC/mcp-traffic-guard-lab)

It is a local Node.js lab that models the core idea without Cloudflare, TLS inspection, OAuth, paid APIs, or secrets. It runs a mock upstream JSON-RPC service and a small guard proxy. The proxy detects MCP-like requests using protocol headers and JSON-RPC shape, then blocks MCP traffic to unapproved upstream hosts while letting ordinary JSON-RPC pass through.

Run it locally:

```bash
git clone https://github.com/A2Techify-LLC/mcp-traffic-guard-lab.git
cd mcp-traffic-guard-lab
npm test
```

Start the demo:

```bash
npm start
```

Send an approved MCP-like tool call:

```bash
curl -s http://127.0.0.1:8787/mcp \
  -H 'content-type: application/json' \
  -H 'x-upstream-url: http://127.0.0.1:8788/mcp' \
  -H 'mcp-protocol-version: 2025-06-18' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_weather","arguments":{"city":"Austin"}}}'
```

Then try changing `x-upstream-url` to `https://tools.example.net/mcp`. The guard returns `403` because the request looks like MCP traffic and the destination is not approved.

## Sample Repo

The sample keeps the policy intentionally small:

```js
const detection = detectMcpRequest({ headers: req.headers, body });
const approved = approvedHosts.has(upstream.host);

if (detection.isMcpLike && !approved) {
  return json(res, 403, {
    error: "blocked_mcp_unapproved_destination",
    upstreamHost: upstream.host,
    detection
  });
}
```

The smoke test covers three cases:

- an approved MCP-like `tools/call` request succeeds;
- an unapproved MCP-like `tools/call` request is blocked;
- an ordinary JSON-RPC request passes through and is marked with `x-mcp-guard-confidence: none`.

This is deliberately not a production gateway. It is a compact teaching repo for the detection and approved-path pattern.

## Cost And Operational Notes

The sample is free to run locally with Node.js 20 or newer. It has no runtime package dependencies and does not call external services during tests.

In a real environment, there are several limits to keep in mind:

- Network detection only sees traffic that passes through the managed network path.
- Local `stdio` MCP servers do not create HTTP traffic for a gateway to inspect.
- Missing `MCP-Protocol-Version` is not enough to prove a request is not MCP.
- TLS inspection, DLP, and identity-aware policy need careful rollout and employee communication.
- Server-side tool authorization still matters, especially for write actions such as deployments, ticket updates, data deletion, or infrastructure changes.

Cloudflare's MCP server portal documentation describes a more complete managed pattern: centralize multiple MCP servers behind one endpoint, authenticate users through Access, curate tools and prompts, optionally route portal traffic through Gateway, and log tool requests.

## What To Watch Next

The next practical step is tool-level risk classification. Teams will want simple labels such as read, write, privileged write, and destructive action. Once those labels exist, clients can ask for confirmation, gateways can route or block, and MCP servers can enforce the final decision before the handler runs.

The bigger pattern is that agent infrastructure is starting to look like regular infrastructure. Tool catalogs, auth flows, audit logs, allowlists, rate limits, and dry-run modes are becoming table stakes.

## References

- [Cloudflare Blog: How Cloudflare detects MCP traffic and helps secure it](https://blog.cloudflare.com/mcp-security-updates/)
- [Cloudflare docs: MCP server portals](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/mcp-portals/)
- [Model Context Protocol specification: Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [A2Techify sample repo: MCP Traffic Guard Lab](https://github.com/A2Techify-LLC/mcp-traffic-guard-lab)
