---
order: 10
sidebarTitle: "Overview"
---

# Breeze overview

Breeze (微风) is a local browser workspace for reusable network rules. A rule can modify request or response headers, redirect or block a request, allow traffic, or upgrade an insecure URL scheme.

Each rule is stored as a **profile** with three main parts:

- an [action](/reference/actions/) that defines what the browser does;
- [conditions](/reference/conditions/) that select requests;
- a [priority](/reference/priorities) used when profiles overlap.

Breeze uses Chrome's Declarative Net Request API. The browser evaluates and applies registered rules; Breeze manages the profile editor, storage, rule registration, and error reporting.

## Common uses

- Add an authorization or feature-flag header during development.
- Select an existing browser cookie and append it to matching requests.
- Change response headers while testing CORS or iframe behavior.
- Redirect an API or asset to another environment.
- Block an unwanted request while debugging a page.
- Limit a rule to one domain, method, resource type, tab, or tab group.
- Export profiles for backup or sharing.

## What Breeze does not do

Breeze does not provide a network log, inspect request or response bodies, modify bodies, or act as a system proxy. Browser and DNR restrictions still apply to every profile.

Continue with [installation](/start/installation), or create [your first profile](/start/first-profile).
