---
order: 70
sidebarTitle: "Import, export, and share"
---

# Import, export, and share profiles

## Export profiles

1. Open the Export page from a profile's **Share** action.
2. Select the profiles to include.
3. Review the redaction summary and the actual JSON preview.
4. Copy the JSON, download it, or create a Breeze share link.

Internal IDs, tab IDs and tab-group conditions are removed from exported profiles. Version 2 exports preserve group names, colors, types, selected memberships and remembered profiles using exchange-local references.

::: warning Review secrets
Recognized credential Header values are cleared by default, including disabled request and response rows. Names include Authorization, Proxy-Authorization, Cookie, Set-Cookie, API keys, and names ending in token or secret. You can explicitly retain Header values for this export page. Synchronized Cookie values are always cleared.

Detection depends on Header names and cannot find every custom credential. Comments, profile names and redirect URLs remain unchanged and can contain private information. Review the preview before sharing.
:::

JSON edits pass through the same sanitizer as copied JSON, downloads and share links. Removing a credential manually keeps it removed when the inclusion toggle changes. Copying a share link is canceled if its selection, inclusion state or page changes during compression.

## Import profiles

1. Open the Import page.
2. Paste JSON, choose an exported file, or open a Breeze share link.
3. Review the profile/group count, actions, request-domain restrictions and validation errors.
4. Confirm the import. Profiles start paused by default.
5. Inspect the imported profiles before enabling them. To activate immediately, explicitly select **Preserve the file’s enabled states** before confirmation; profiles disabled in the source file stay disabled.

Imported profiles and groups receive new internal IDs and do not overwrite saved profiles or groups with similar names. Legacy version 1 exports remain importable as ungrouped profiles. Imports containing synchronized cookies can request the optional Cookies permission.

Preflight rejects inconsistent nested radio groups, multiple enabled single-selection entries, conflicting include/exclude method or resource-type conditions, invalid Header names or line breaks, out-of-range priority, and invalid Allow All Requests resource types. Intentional regex-over-URL precedence and overlapping domain exclusions remain supported. Chrome still performs rule registration validation after activation; preflight does not prove that a real request matches.

Profiles and groups are appended together after the complete exchange passes validation and required permission checks. By default, pausing a group preserves its intended resume selection.

JSON and file imports, exported JSON, and decompressed share payloads are limited to **1 MiB of UTF-8 data**. Select fewer profiles to exchange larger collections in batches. Shared payload decompression stops when it exceeds the limit.
