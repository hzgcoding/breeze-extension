---
order: 65
sidebarTitle: "Import from cURL"
---

# Create a Header profile from cURL

1. In DevTools Network, copy a request as **cURL (bash)**.
2. Open the terminal icon in Breeze Workflow's top toolbar.
3. Paste the command and review the request domain, method, explicit Headers and warnings.
4. Create the profile. It starts paused and does not change any existing environment group.
5. Inspect the resulting Header actions and conditions before enabling it.

For example:

```sh
curl 'https://api.example.com/orders?debug=1' \
  -H 'Authorization: Bearer example-token' \
  -H 'X-Environment: development' \
  --data-raw '{"id":123}'
```

This creates a paused profile for `api.example.com`, method `POST`, with the two explicit Headers. The request body and URL query are not saved. Creating the profile does not send a request or execute a shell command.

## Scope and supported input

The domain condition includes subdomains. It does not restrict URL paths, protocols or ports. Edit the generated conditions if you need a narrower scope.

The parser supports single and double quotes, Bash ANSI-C quoted strings, escaped quotes and line continuations. Header options include `-H` / `--header`, `-b` / `--cookie`, `-A` / `--user-agent`, and `-e` / `--referer`. Explicit methods and common GET/HEAD/body flags determine the method condition.

Request bodies and supported network options are not imported; the preview shows warnings when they are present. Repeated Header names use the last explicit value and show a warning. cURL's implicit default Headers are not reconstructed.

Only one HTTP(S) request is supported. Unknown options, file references, URL credentials, multiple URLs, shell expansion/operators, custom methods, IPv6 literals, cmd/PowerShell commands and malformed Headers are rejected. Empty Header values (`Name;`) and cURL Header suppression (`Name:`) are rejected because the current Header engine cannot reproduce those semantics.

Pasted command text is cleared when the dialog closes. A created profile stores the selected Header values locally, so check the export redaction preview before sharing it.
