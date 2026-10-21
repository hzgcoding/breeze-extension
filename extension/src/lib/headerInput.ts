export interface ParsedHeader {
  name: string;
  value: string;
  line: number;
}

export interface HeaderInputError {
  line: number;
  reason: "missingColon" | "invalidName" | "invalidValue";
}

export function isValidHeaderName(name: string) {
  return name.length > 0 && !/[^!#$%&'*+\-.^\w`|~]/.test(name);
}

export function isValidHeaderValue(value: string) {
  return !/[\r\n]/.test(value);
}

export function parseHeaderLines(text: string) {
  const headers: ParsedHeader[] = [];
  const errors: HeaderInputError[] = [];

  text.split(/\r?\n/).forEach((input, index) => {
    const line = index + 1;
    if (/^[\t ]*$/.test(input))
      return;

    const colon = input.indexOf(":");
    if (colon === -1) {
      errors.push({ line, reason: "missingColon" });
      return;
    }

    const name = input.slice(0, colon);
    const value = input.slice(colon + 1);
    if (!isValidHeaderName(name)) {
      errors.push({ line, reason: "invalidName" });
    } else if (!isValidHeaderValue(value)) {
      errors.push({ line, reason: "invalidValue" });
    } else {
      headers.push({ name, value: value.replace(/^[\t ]+|[\t ]+$/g, ""), line });
    }
  });

  return { headers, errors };
}
