<script setup lang="ts">
import type { Profile } from "@/lib/schema";
import { Button } from "@breeze/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@breeze/ui/components/dropdown-menu";
import { cn } from "@breeze/ui/lib/utils";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { useJsonValidation } from "@/composables/useJsonValidation";
import JsonEditor from "@/entrypoints/popup/components/JsonEditor/index.vue";
import { useProfilesStore } from "@/entrypoints/popup/stores/useProfilesStore";
import { sanitizeProfileExport, serializeProfileExport } from "@/lib/profileExport";
import { createProfileShareLink } from "@/lib/profileShareLink";
import { createProfileExchange } from "@/lib/schema";
import ExportPrivacy from "./components/ExportPrivacy.vue";
import ProfileCheckboxes from "./components/ProfileCheckboxes.vue";

const profilesStore = useProfilesStore();
const route = useRoute();
const { t } = useI18n();

const selectedProfiles = ref<Profile[]>([]);

const rawDraft = ref("");
const retainSensitive = ref(false);
const exporting = ref(false);
const editorRevision = ref(0);
let revision = 0;
watch([rawDraft, retainSensitive, () => route.fullPath], () => revision++, { flush: "sync" });
onBeforeUnmount(() => revision++);

const exportSnapshot = computed(() => {
  try {
    return sanitizeProfileExport(JSON.parse(rawDraft.value), retainSensitive.value);
  } catch {
    return null;
  }
});
// Edits replace the shown draft, so removed credentials never reappear on toggle.
const jsonPreview = computed({
  get: () => exportSnapshot.value ? JSON.stringify(exportSnapshot.value.exchange, null, 2) : rawDraft.value,
  set: (value: string) => {
    rawDraft.value = value;
    // The editor can contain new secrets even when the sanitized model is equal
    // to its old value. Refresh it so the visible document matches the payload.
    if (value !== jsonPreview.value)
      editorRevision.value++;
  },
});

// Auto-select profile from route param
watch(() => [profilesStore.ready, route.params.id] as const, ([ready, id]) => {
  if (!ready)
    return;
  const profile = profilesStore.manager.profiles.find(p => p.id === id);
  if (profile) {
    selectedProfiles.value = [profile];
    handleSelectionChange([profile]);
  }
}, { immediate: true });

function handleSelectionChange(profiles: Profile[]) {
  selectedProfiles.value = profiles;
  updateJsonPreview();
}

function updateJsonPreview() {
  const profiles = selectedProfiles.value;
  if (profiles.length === 0) {
    rawDraft.value = "";
    return;
  }
  const profileExchange = createProfileExchange(profiles, profilesStore.manager.profileGroups);
  rawDraft.value = JSON.stringify(profileExchange, null, 2);
}

const { validJson, validJsonSchema, formatJson } = useJsonValidation(jsonPreview);

async function runExport(action: (json: string, current: () => boolean) => Promise<void> | void) {
  if (exporting.value || !exportSnapshot.value)
    return;
  // Every sink receives one validated, sanitized snapshot, including edited JSON.
  exporting.value = true;
  try {
    const json = serializeProfileExport(exportSnapshot.value.exchange, retainSensitive.value);
    const startedAt = revision;
    await action(json, () => revision === startedAt);
  } catch (error) {
    toast.error(error instanceof RangeError ? t("exportPrivacy.tooLarge") : t("exportPrivacy.failed"));
  } finally {
    exporting.value = false;
  }
}

async function handleCopyJson() {
  await runExport(async (json) => {
    await navigator.clipboard.writeText(json);
    toast.success(t("share.toast.jsonCopied"));
  });
}

async function handleCopyShareLink() {
  await runExport(async (json, current) => {
    const link = await createProfileShareLink(json);
    // Selection or route changes during compression invalidate the old snapshot.
    if (!current())
      return;
    await navigator.clipboard.writeText(link);
    toast.success(t("share.toast.linkCopied"));
  });
}

async function handleDownloadJson() {
  await runExport((json) => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "breeze-profiles.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}
</script>

<template>
  <div
    v-if="profilesStore.ready"
    :class="cn(
      `grid grid-cols-[3.5rem_minmax(0,1fr)] grid-rows-[4rem_minmax(0,1fr)]`,
      'size-full',
    )"
  >
    <aside
      class="
        workspace-rail col-start-1 row-span-2 flex h-full flex-col
        justify-between border-r bg-sidebar py-2
      "
    >
      <Button as-child size="icon-sm" variant="secondary" class="mx-2">
        <RouterLink to="/profiles">
          <i class="i-lucide-arrow-left size-4" />
          <span class="sr-only">{{ t("common.backToProfiles") }}</span>
        </RouterLink>
      </Button>
      <div
        class="
          flex h-4 items-center self-stretch
          before:h-px before:w-full before:grow before:bg-border
          before:content-['']
        "
      />
      <ProfileCheckboxes v-model="selectedProfiles" :scroll-target-id-on-mounted="route.params.id" @change="handleSelectionChange" />
    </aside>
    <header
      class="
        col-start-2 row-start-1 flex items-center justify-between border-b px-2
      "
    >
      <h1
        class="flex items-center gap-2 text-base font-semibold"
      >
        {{ t("share.title") }}
      </h1>
      <div class="flex justify-end space-x-2">
        <Button
          size="sm"
          variant="secondary"
          :disabled="!validJson || exporting"
          @click="jsonPreview = formatJson()"
        >
          <i class="i-lucide-braces" />
          {{ t("common.beautify") }}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              data-testid="export-menu-trigger"
              size="sm"
              :disabled="!validJsonSchema || exporting"
            >
              <i class="i-lucide-share-2" />
              {{ t("common.share") }}
              <i class="i-lucide-chevron-down" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" :collision-padding="8" class="z-500">
            <DropdownMenuItem data-testid="export-copy-link" @click="handleCopyShareLink">
              <i class="i-lucide-link" />
              {{ t("share.copyLink") }}
            </DropdownMenuItem>
            <DropdownMenuItem data-testid="export-copy-json" @click="handleCopyJson">
              <i class="i-lucide-copy" />
              {{ t("share.copyToClipboard") }}
            </DropdownMenuItem>
            <DropdownMenuItem data-testid="export-download-json" @click="handleDownloadJson">
              <i class="i-lucide-hard-drive-download" />
              {{ t("share.saveAsFile") }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    <main
      class="
        col-start-2 row-start-2 flex flex-col overflow-x-hidden overflow-y-auto
      "
    >
      <ExportPrivacy
        v-model="retainSensitive"
        :count="exportSnapshot?.sensitiveHeaderCount ?? 0"
        :names="exportSnapshot?.sensitiveHeaderNames ?? []"
        :busy="exporting"
        :valid="!!exportSnapshot"
      />
      <div class="flex flex-1 flex-col">
        <div class="flex h-full flex-1 flex-col space-y-2">
          <JsonEditor
            :key="editorRevision"
            v-model="jsonPreview"
            :readonly="exporting"
            class="flex-1"
            height="100%"
            search-panel-sticky-top="2.25rem"
          />
        </div>
      </div>
    </main>
  </div>
</template>
