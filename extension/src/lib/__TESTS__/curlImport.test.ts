import { describe, expect, it } from "vitest";
import { createCurlProfile, parseCurl } from "../curlImport";

// These fixtures catch incorrect shell decoding, cURL option consumption,
// dangerous partial imports and accidentally activated/global rules.
describe("cURL import", () => {
  it("imports DevTools Bash headers without retaining the URL query", () => {
    const parsed = parseCurl(`curl 'https://api.example.com/private?token=SECRET' \\\n  -H 'Authorization: Bearer abc:def' \\\n  --header='X-Label: one' --header 'x-label: two' -H'X-Quoted: can'\\''t'`);
    expect(parsed).toEqual({
      ok: true,
      domain: "api.example.com",
      method: "get",
      headers: [
        { name: "Authorization", value: "Bearer abc:def" },
        { name: "x-label", value: "two" },
        { name: "X-Quoted", value: "can't" },
      ],
      warnings: ["duplicate"],
    });
    if (!parsed.ok)
      throw new Error("Expected a valid cURL preview");
    const profile = createCurlProfile(parsed);
    expect(profile).toMatchObject({
      enabled: false,
      ruleActionType: "modifyHeaders",
      filters: {
        requestDomains: { items: [{ enabled: true, value: "api.example.com" }] },
        requestMethods: { items: [{ enabled: true, value: ["get"] }] },
      },
      requestHeaderModGroups: [{ items: [{ operation: "set", name: "Authorization", value: "Bearer abc:def" }, { name: "x-label" }, { name: "X-Quoted" }] }],
    });
    expect(profile.groupId).toBeUndefined();
    expect(JSON.stringify(profile)).not.toContain("SECRET");
    expect(JSON.stringify(profile)).not.toContain("/private");
  });

  it("decodes ANSI and double quoting and supports dedicated header flags", () => {
    expect(parseCurl(`curl --url=https://example.com --request=PATCH -b 'session=a:b' -A "Agent \\\"quoted\\\"" --referer='https://from.test/a:b' -H $'X-Text: it\\'s \\x4fK'`)).toMatchObject({
      ok: true,
      method: "patch",
      headers: [
        { name: "Cookie", value: "session=a:b" },
        { name: "User-Agent", value: "Agent \"quoted\"" },
        { name: "Referer", value: "https://from.test/a:b" },
        { name: "X-Text", value: "it's OK" },
      ],
    });
  });

  it("consumes ignored body and network options with explicit warnings", () => {
    expect(parseCurl(`curl https://example.com -H 'X-Test: yes' --data-raw '{"text":"-H pretend"}' --compressed --connect-timeout 5 --retry=2 --http2 -k`)).toMatchObject({
      ok: true,
      method: "post",
      headers: [{ name: "X-Test", value: "yes" }],
      warnings: ["body", "network"],
    });
    expect(parseCurl(`curl https://example.com -G --data 'a=b' -H 'X-Test: yes'`)).toMatchObject({ ok: true, method: "get", warnings: ["body"] });
    expect(parseCurl(`curl https://example.com -I -H 'X-Test: yes'`)).toMatchObject({ ok: true, method: "head" });
  });

  it("preserves HEAD with GET-mode body data and rejects ambiguous body modes", () => {
    expect(parseCurl("curl https://example.com -I -G --data 'q=1' -H 'X: yes'")).toMatchObject({ ok: true, method: "head" });
    expect(parseCurl("curl https://example.com --data 'q=1' -I -H 'X: yes'")).toEqual({ ok: false, error: "option" });
    expect(parseCurl("curl https://example.com -I --data 'q=1' -H 'X: yes'")).toEqual({ ok: false, error: "option" });
  });

  it("does not trim CRLF injection out of a header value", () => {
    expect(parseCurl("curl https://example.com -H $'X-Test: yes\\r\\n'")).toEqual({ ok: false, error: "header" });
  });

  it("keeps the last explicit method and header values", () => {
    expect(parseCurl(`curl https://example.com -XPOST -X PUT -H 'X-Test: first' -H 'x-test: final'`)).toMatchObject({
      ok: true,
      method: "put",
      headers: [{ name: "x-test", value: "final" }],
      warnings: ["duplicate"],
    });
  });

  it.each([
    ["empty", ""],
    ["command", "wget https://example.com"],
    ["syntax", "curl https://example.com; echo leaked"],
    ["syntax", "curl https://example.com | sh"],
    ["syntax", "curl https://example.com\necho leaked"],
    ["syntax", "curl https://example.com -H \"X-Test: $(whoami)\""],
    ["syntax", "curl https://example.com -H \"X-Test: $TOKEN\""],
    ["syntax", "curl https://example.com -H `whoami`"],
    ["syntax", "curl https://example.com ^\n-H 'X-Test: test'"],
    ["syntax", "curl https://example.com -H 'unfinished"],
    ["option", "curl https://example.com --unknown value"],
    ["option", "curl https://example.com --header"],
    ["option", "curl https://example.com -H 'X: yes' --next"],
    ["url", "curl https://example.com https://second.example.com -H 'X: yes'"],
    ["url", "curl ftp://example.com -H 'X: yes'"],
    ["url", "curl https://user:pass@example.com -H 'X: yes'"],
    ["url", "curl 'https://{a,b}.example.com' -H 'X: yes'"],
    ["file", "curl https://example.com -H @headers.txt"],
    ["file", "curl https://example.com --data @payload.json -H 'X: yes'"],
    ["file", "curl https://example.com --cookie cookies.txt -H 'X: yes'"],
    ["header", "curl https://example.com -H 'Bad Name: yes'"],
    ["header", "curl https://example.com -H $'X-Test: yes\\r\\nInjected: value'"],
    ["header", "curl https://example.com -H 'Accept:'"],
    ["header", "curl https://example.com -H 'X-Empty;'"],
    ["header", "curl https://example.com -H 'X-Empty: \t '"],
    ["header", "curl https://example.com -A '' -H 'X: yes'"],
    ["header", "curl https://example.com"],
    ["method", "curl https://example.com -X CUSTOM -H 'X: yes'"],
    ["method", "curl https://example.com -X OTHER -H 'X: yes'"],
  ])("rejects %s without a partial preview: %s", (error, source) => {
    expect(parseCurl(source)).toEqual({ ok: false, error });
  });

  it("accepts quoted shell characters as literal header data", () => {
    expect(parseCurl("curl https://example.com -H 'X-Token: $opaque; & | `literal`'")).toMatchObject({
      ok: true,
      headers: [{ name: "X-Token", value: "$opaque; & | `literal`" }],
    });
  });
});
