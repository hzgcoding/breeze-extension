---
order: 20
---

# Profile groups

Profile groups organize top-level profiles and optionally coordinate which profiles are enabled.

## Fields

| Field               | Description                                  |
|---------------------|----------------------------------------------|
| Name                | User-visible group name                      |
| Color               | Sidebar color selected from Breeze presets |
| Type                | `checkbox` or `radio`                        |
| Remembered profiles | Internal list used by Pause and remember     |

## Checkbox groups

Any number of profiles in a checkbox group can be enabled. Enabling or disabling one profile does not automatically change the others.

## Radio groups

At most one profile in a radio group can be enabled. Enabling a profile disables other enabled profiles in the same group.

## Pause and resume

**Pause and remember** disables the group and records which profiles were enabled. **Resume saved profiles** restores every remembered profile in a checkbox group or the first remembered profile in a radio group.

Changing a member profile's enabled state separately clears the remembered state.

## Sidebar context menus

Right-click a profile emoji in the Sidebar to open its context menu. From there, you can pause or resume the profile, duplicate it, change its group membership, edit comments or priority, change its action type, export it, or delete or reset it.

Right-click a profile group header to open the group context menu. From there, you can edit the group's name and color, switch between radio and checkbox mode, create a profile in the group, pause or resume remembered profiles, remove all profiles from the group, or delete the group.

## Storage and export

Groups and memberships are stored locally as organizational data. They do not affect DNR rule contents. Removing the final member causes an empty group to be cleaned up.

Version 2 exports preserve group names, colors, types, membership and remembered profiles. Only selected profiles and their groups are exported. Exporting one member of a larger group keeps that group's metadata and remembers only selected members. Unused groups and stale membership references are omitted.

The exchange uses local references such as `profile-1` and `group-1` instead of storage UUIDs:

```json
{
  "version": 2,
  "profiles": [
    {
      "ref": "profile-1",
      "groupRef": "group-1",
      "name": "Staging",
      "enabled": false,
      "emoji": "S",
      "ruleActionType": "modifyHeaders",
      "filters": {}
    }
  ],
  "profileGroups": [
    {
      "ref": "group-1",
      "name": "Environments",
      "color": "#8ab4f8",
      "type": "radio",
      "lastEnabledProfileRefs": ["profile-1"]
    }
  ]
}
```

Import appends new profiles and groups, including when a saved group has the same name. Every profile, group and nested item receives a fresh UUID, and memberships and remembered profiles are linked to those new IDs. Radio groups retain their mutually exclusive behavior. Duplicate or dangling references and radio groups with multiple enabled profiles are rejected before import. Legacy version 1 exports remain importable as ungrouped profiles.

Temporary tab conditions remain excluded from exports, and cookie values remain redacted. Other header values and comments remain visible in the JSON preview. Group portability does not change the local storage format.
