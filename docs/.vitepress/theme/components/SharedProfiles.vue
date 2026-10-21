<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { RELEASES_URL } from "../../../../extension/src/lib/product";
import { decodeProfileSharePayload } from "../../../../extension/src/lib/profileShare";
import { getProfileSharePayload } from "../../../../extension/src/lib/profileShareLink";

const json = ref("");
const status = ref("Loading the shared profiles…");
const ready = computed(() => json.value.length > 0);
let revision = 0;

async function readShare() {
  const current = ++revision;
  json.value = "";
  const payload = getProfileSharePayload(window.location.href);
  if (!payload) {
    status.value = "This link has no valid shared-profile payload. Check that the complete link was copied.";
    return;
  }
  status.value = "Decoding the profiles in this browser…";
  try {
    const decoded = await decodeProfileSharePayload(payload);
    JSON.parse(decoded);
    if (current !== revision)
      return;
    json.value = decoded;
    status.value = "Profiles decoded locally. Review the JSON before importing.";
  } catch {
    if (current === revision)
      status.value = "This shared payload is invalid or exceeds the 1 MiB import limit.";
  }
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(json.value);
    status.value = "JSON copied. Paste it into the extension’s Import page.";
  } catch {
    status.value = "Clipboard access is unavailable. Download the JSON instead.";
  }
}

function downloadJson() {
  const url = URL.createObjectURL(new Blob([json.value], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "shared-profiles.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

onMounted(() => {
  void readShare();
  window.addEventListener("hashchange", readShare);
});
onBeforeUnmount(() => {
  revision++;
  window.removeEventListener("hashchange", readShare);
});
</script>

<template>
  <main class="mx-auto max-w-3xl space-y-6 px-6 py-12 text-foreground">
    <header class="space-y-3">
      <p class="text-sm text-muted-foreground">
        Browser network profiles
      </p>
      <h1 class="text-3xl font-semibold tracking-tight">
        Open shared profiles
      </h1>
      <p>
        With the extension installed and enabled, this link opens its Import preview.
        Imports stay paused until you enable them or explicitly preserve their enabled state.
      </p>
    </header>

    <section
      aria-label="Install and import" class="
        space-y-3 rounded-xl border bg-card p-5
      "
    >
      <h2 class="text-lg font-semibold">
        If the Import preview did not open
      </h2>
      <ol class="list-decimal space-y-2 pl-5">
        <li>
          <a
            :href="RELEASES_URL" target="_blank" rel="noopener noreferrer" class="
              text-primary underline
            "
          >Download this extension from Releases</a>
          and load the extracted Chrome extension directory.
        </li>
        <li>Reopen the complete share link in the same browser profile.</li>
        <li>Or copy or download the JSON below, then use the extension’s Import page.</li>
      </ol>
    </section>

    <section aria-label="Shared JSON" class="space-y-3">
      <p role="status" aria-live="polite" class="text-sm text-muted-foreground">
        {{ status }}
      </p>
      <div class="flex flex-wrap gap-3">
        <button
          :disabled="!ready" class="
            rounded-lg bg-primary px-4 py-2 text-primary-foreground
            disabled:opacity-50
          " @click="copyJson"
        >
          Copy JSON
        </button>
        <button
          :disabled="!ready" class="
            rounded-lg border bg-card px-4 py-2
            disabled:opacity-50
          " @click="downloadJson"
        >
          Download JSON
        </button>
      </div>
      <details v-if="ready" class="rounded-xl border bg-card p-4">
        <summary class="cursor-pointer font-medium">
          Review decoded JSON
        </summary>
        <textarea
          :value="json" readonly aria-label="Decoded shared profiles JSON" spellcheck="false" class="
            mt-3 h-80 w-full resize-y rounded-lg border bg-background p-3
            font-mono text-xs
          "
        />
      </details>
    </section>

    <p class="text-sm text-muted-foreground">
      Profile data stays in the URL fragment and is decoded locally; this page does not upload it.
      The payload is compressed, not encrypted. Recognized sensitive headers are cleared by default
      and synchronized Cookie values are always cleared, but other profile data can still contain secrets.
      Check the values and target conditions before enabling imported profiles.
    </p>
  </main>
</template>
