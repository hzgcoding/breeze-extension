---
order: 40
---

# Privacy model

Breeze stores profiles and settings locally in your browser. It does not require an account, run a profile-sync service, or automatically upload your configuration. The extension does not include analytics or telemetry.

## Request handling

Breeze translates profiles into declarative browser rules. The browser applies matching actions internally; Breeze does not proxy traffic or read request and response bodies. Rule registrations and registration errors are also stored locally.

Breeze has host access for all URLs so profiles can target the sites you configure. A profile's conditions determine which requests it affects. Headers and redirects you configure can send data to those selected destinations.

## Cookie synchronization

After you grant the optional Cookies permission, Breeze reads the selected cookie values and watches them for changes. Those values are stored locally in profiles and can be appended to matching requests.

Treat synchronized values as secrets. The profile's target conditions, rather than the original cookie's Domain, Path, SameSite, or Secure attributes, control where a copied value is appended. Restrict the destination conditions before enabling a profile.

## Export and sharing

Recognized credential Header values are cleared by default from exported JSON, downloads, and share links. You can explicitly retain Header values during export. Synchronized Cookie values are always cleared; the Cookie identity is retained so a receiving browser can synchronize its own local value.

Credential detection depends on Header names. Custom headers, comments, profile names, and URLs can still contain private information. Review the JSON preview before exporting or sharing.

A share link stores compressed profile data in its URL fragment. The shared-profile page decodes that fragment locally and does not upload its contents. Compression is not encryption: anyone with the complete link can read its data. The service you use to send the link may also store it.

See [Import, export, and share](/guides/import-export-share) for the default redaction rules and import review flow.

## Documentation website

The documentation is hosted at [hzgcoding.github.io/breeze](https://hzgcoding.github.io/breeze/) on GitHub Pages. Fonts and search assets are bundled with the site; documentation search runs locally without an external search provider. The site does not include analytics.

Your browser still connects to GitHub Pages to load the site and to GitHub when you follow source or release links. Those services receive ordinary web requests. A shared link's fragment is not included in the HTTP request to the documentation host.

## Removing local data

Deleting a profile removes it from Breeze's saved configuration. Removing the extension clears its browser-managed local storage. Exported files and links you have copied remain wherever you saved or sent them.
