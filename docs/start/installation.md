---
order: 20
---

# Install Breeze

Breeze is distributed as a ZIP from [GitHub Releases](https://github.com/hzgcoding/breeze/releases). Use Chrome 145 or a Chromium-based browser with the same required extension APIs.

## Load the release ZIP

1. Open [Breeze Releases](https://github.com/hzgcoding/breeze/releases) and download the Chrome extension ZIP attached to a release. The GitHub **Source code** archives are not installable extension packages.
2. Extract the ZIP to a folder you can keep on your computer.
3. Open `chrome://extensions` in Chrome and enable **Developer mode**.
4. Choose **Load unpacked** and select the extracted directory containing `manifest.json`.
5. Pin **Breeze** to the browser toolbar and open it. The Profiles page is ready for your first rule.

In Microsoft Edge, use `edge://extensions` for the same unpacked-extension workflow. The supported baseline is the Chromium API version required above.

Breeze currently uses release ZIPs for distribution. This project does not link to a Chrome Web Store or Edge Add-ons listing.

## Update an unpacked installation

Download a new release ZIP, replace the files in your existing extension folder, and choose **Reload** on Breeze's card in the extension manager. Reloading the same unpacked installation keeps its local profiles and settings. Export a backup before updating or removing an installation.

## Keyboard shortcut

Open `chrome://extensions/shortcuts`, find Breeze, and assign a shortcut to **Turn Breeze on or off**. Use it to pause or resume all Breeze rules without opening the extension.

## Permissions

The core extension uses the following permissions:

| Permission                    | Purpose                                                        |
|-------------------------------|----------------------------------------------------------------|
| `storage`                     | Stores profiles, settings, registration records, and errors     |
| `declarativeNetRequest`        | Registers browser network rules                                |
| Host access to `<all_urls>`   | Allows rules and cookie lookup across configured sites         |

Cookie synchronization and tab-group conditions request additional permissions only when used.

### `cookies`

Requested when cookie synchronization is added or imported. It allows Breeze to list selected-domain cookies, read their values, and receive change notifications. Breeze does not create or delete browser cookies through this feature.

### `tabGroups`

Requested when a Tab Groups condition is added. It allows Breeze to list groups and observe group removal. Breeze uses the Tabs API to resolve the tabs contained in each group.

Declining an optional permission cancels the operation that requires it. Existing unrelated profiles continue to work.
