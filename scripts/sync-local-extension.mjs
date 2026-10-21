import { copyFile, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "extension/.output/chrome-mv3");
const configPath = join(root, ".local-extension.json");
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--target"))
  throw new Error("Usage: pnpm build:local --target <loaded extension directory>");

let config = {};
try {
  config = JSON.parse(await readFile(configPath, "utf8"));
}
catch (error) {
  if (error.code !== "ENOENT")
    throw error;
}
const requested = args[1] || config.target;
if (!requested)
  throw new Error("Choose a loaded directory first: pnpm build:local --target <directory>");
const target = resolve(requested);
if (target === root || !relative(target, source).startsWith(`..${sep}`)
  || !relative(source, target).startsWith(`..${sep}`)) {
  throw new Error("The loaded extension directory must be outside the source/build directories.");
}
const manifest = JSON.parse(await readFile(join(source, "manifest.json"), "utf8"));
if (manifest.manifest_version !== 3 || !manifest.background?.service_worker || !manifest.action?.default_popup)
  throw new Error("Expected a complete production extension build.");
const expectedVersion = JSON.parse(await readFile(join(root, "extension/package.json"), "utf8")).version;
if (manifest.version !== expectedVersion)
  throw new Error("The production build is stale. Run pnpm build:local again.");
try {
  if ((await readdir(target)).length > 0) {
    const installed = JSON.parse(await readFile(join(target, "manifest.json"), "utf8"));
    if (installed.manifest_version !== 3)
      throw new Error("The target must be an unpacked extension directory.");
  }
}
catch (error) {
  if (error.code !== "ENOENT")
    throw error;
  // An empty/new directory is valid, but an existing unrelated directory is not.
  if (await readdir(target).then(entries => entries.length > 0).catch(() => false))
    throw new Error("The target is not an unpacked extension directory.");
}

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => entry.isDirectory()
    ? filesIn(join(directory, entry.name))
    : join(directory, entry.name)));
  return files.flat();
}

const files = await filesIn(source);
// Publish entry points last. Retain previous hashed assets for already-open tabs.
const last = [
  ...(manifest.content_scripts ?? []).flatMap(script => script.js ?? []),
  manifest.background.service_worker,
  manifest.action.default_popup,
  "manifest.json",
];
for (const entry of last) {
  if (!files.includes(join(source, entry)))
    throw new Error(`Incomplete extension build: ${entry}`);
}
const order = file => last.indexOf(relative(source, file).split(sep).join("/"));
files.sort((a, b) => order(a) - order(b));
for (const file of files) {
  const destination = join(target, relative(source, file));
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(file, `${destination}.next`);
  await rename(`${destination}.next`, destination);
}
await writeFile(configPath, `${JSON.stringify({ target }, null, 2)}\n`);
process.stdout.write(`Updated v${manifest.version}: ${target}\nReopen the popup for UI changes. Reload the extension after background or manifest changes.\n`);
