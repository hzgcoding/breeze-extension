---
order: 15
---

# Switch complete environments

Create a profile for each environment, with all of its headers and request-domain conditions. Enable the required header rows within each profile.

Click **Group environments** above the editor, enter a group name, and select at least two profiles. Creating a group moves those profiles from their previous groups and keeps at most one currently enabled member. Previously paused profiles stay paused.

The group selector is always visible above the editor. Choosing BOE or PPE enables that complete profile and pauses its siblings. **Paused** disables the group without deleting its configuration. Profiles outside the group keep their existing state.

Use the **Open in tab** button in the header to edit while viewing DevTools or another page.

## Understand the status

The profile status distinguishes paused, empty, invalid, pending, and registered configurations. **Registered** means Chrome accepted a rule; it does not report a request hit. The extension badge continues to count registered rules.

The URL check evaluates request-domain inclusion and exclusion locally. It reports an incomplete check when URL patterns or request-context conditions need Chrome's matcher. It does not send the entered URL to a server or read network payloads. Potential header conflicts identify competing operations without displaying header values.

## Enter and migrate headers

Use **Paste headers** in a request or response header group to preview several `Name: value` lines before adding them. The parser preserves colons inside values and reports invalid lines. No rows are added until the complete input is valid. Invalid names are excluded from recent-header shortcuts.

JSON exports preserve selected profile groups, mutual exclusion, and membership. Importing assigns new IDs to prevent collisions with existing configurations. Legacy version 1 exports remain supported. Only selected profiles and their groups are exported; unrelated group members are not included.
