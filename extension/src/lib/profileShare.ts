import { MAX_PROFILE_IMPORT_BYTES } from "./const";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

export async function encodeProfileSharePayload(json: string) {
  const input = textEncoder.encode(json);
  if (input.byteLength > MAX_PROFILE_IMPORT_BYTES)
    throw new RangeError("Profile share exceeds the 1 MiB import limit.");
  const compressed = await gzip(input);
  let binary = "";
  // Bound argument counts when converting large byte arrays for btoa.
  for (let offset = 0; offset < compressed.length; offset += 8192)
    binary += String.fromCharCode(...compressed.subarray(offset, offset + 8192));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export async function decodeProfileSharePayload(payload: string) {
  if (payload.length > MAX_PROFILE_IMPORT_BYTES * 2)
    throw new RangeError("Profile share exceeds the import limit.");
  const binary = atob(payload.replaceAll("-", "+").replaceAll("_", "/"));
  const compressed = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++)
    compressed[index] = binary.charCodeAt(index);
  const decompressed = await gunzip(compressed);
  return textDecoder.decode(decompressed);
}

async function gzip(input: Uint8Array) {
  const stream = new Blob([toArrayBuffer(input)]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(input: Uint8Array) {
  const stream = new Blob([toArrayBuffer(input)]).stream().pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done)
        break;
      size += value.byteLength;
      if (size > MAX_PROFILE_IMPORT_BYTES)
        throw new RangeError("Profile share exceeds the decompressed import limit.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function toArrayBuffer(input: Uint8Array) {
  const buffer = new ArrayBuffer(input.byteLength);
  new Uint8Array(buffer).set(input);
  return buffer;
}
