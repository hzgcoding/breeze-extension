/** A deliberately small Bash lexer. It never expands or evaluates source. */
export function curlTokens(source: string): string[] | undefined {
  const tokens: string[] = [];
  let token = "";
  let started = false;
  let quote: "single" | "double" | "ansi" | undefined;
  const text = source.trim();
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    const next = text[index + 1];
    if (quote === "single") {
      if (char === "'")
        quote = undefined;
      else token += char;
      continue;
    }
    if (quote === "ansi") {
      if (char === "'") {
        quote = undefined;
      } else if (char === "\\") {
        const escapes: Record<string, string> = { "n": "\n", "r": "\r", "t": "\t", "b": "\b", "f": "\f", "v": "\v", "a": "\x07", "e": "\x1B", "\\": "\\", "'": "'", "\"": "\"" };
        if (next && next in escapes) {
          token += escapes[next];
          index++;
        } else if (next === "x" || next === "u" || next === "U") {
          const length = { x: 2, u: 4, U: 8 }[next];
          const digits = text.slice(index + 2, index + 2 + length);
          const code = Number.parseInt(digits, 16);
          if (digits.length !== length || /[^\da-f]/i.test(digits) || code > 0x10FFFF)
            return;
          token += String.fromCodePoint(code);
          index += length + 1;
        } else {
          return;
        }
      } else {
        token += char;
      }
      continue;
    }
    if (char === "\\") {
      if (next === "\n") {
        index++;
      } else if (next === "\r" && text[index + 2] === "\n") {
        index += 2;
      } else if (next === undefined) {
        return;
      } else if (quote === "double" && !["\"", "\\", "$", "`"].includes(next)) {
        token += char;
      } else {
        token += next;
        started = true;
        index++;
      }
      continue;
    }
    if (quote === "double") {
      if (char === "\"")
        quote = undefined;
      else if (char === "$" || char === "`")
        return;
      else token += char;
      continue;
    }
    if (char === "$" && next === "'") {
      quote = "ansi";
      started = true;
      index++;
    } else if (char === "'" || char === "\"") {
      quote = char === "'" ? "single" : "double";
      started = true;
    } else if (/[\r\n;|&<>()`$^*?[\]{}]/.test(char) || (char === "#" && !started)) {
      return;
    } else if (/\s/.test(char)) {
      if (started)
        tokens.push(token);
      token = "";
      started = false;
    } else {
      token += char;
      started = true;
    }
  }
  if (quote)
    return;
  if (started)
    tokens.push(token);
  return tokens;
}
