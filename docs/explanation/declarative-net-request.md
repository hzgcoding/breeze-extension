---
order: 10
sidebarTitle: "Declarative Net Request"
---

# How Breeze uses Declarative Net Request

Breeze does not proxy network traffic. It translates each enabled profile into a declarative rule and asks Chrome to register that rule.

A DNR rule contains an integer ID, priority, action, and condition. Breeze owns the mapping between its UUID-based profile IDs and Chrome's integer rule IDs. When a rule-relevant profile field changes, the background worker computes the changed profiles and updates only their registered rules.

Chrome evaluates those rules inside the browser network stack. This design lets the browser apply actions without sending request or response bodies to Breeze's JavaScript code.

## Rule lifecycle

1. Breeze stores the profile locally.
2. Enabled, registerable profiles are converted into DNR actions and conditions.
3. Breeze registers or updates the corresponding browser rules.
4. Registration IDs and errors are stored for the popup.
5. The toolbar badge reflects active registered rules.

Pausing a profile removes its rule. Turning off Breeze removes all Breeze rules. Reinitialization removes and rebuilds them from the saved profiles.

See [Profiles](/reference/profiles) and Chrome's [Declarative Net Request API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest).
