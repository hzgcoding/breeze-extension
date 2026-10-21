<script setup lang="ts">
import { Button } from "@breeze/ui/components/button";
import { cn } from "@breeze/ui/lib/utils";
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import JsonEditor from "#/components/JsonEditor/index.vue";
import { useJsonValidation } from "@/composables/useJsonValidation";
import { useProfilesStore } from "@/entrypoints/popup/stores/useProfilesStore";
import { ensureBrowserPermission } from "@/lib/permissions";
import { inspectProfileImport, MAX_PROFILE_IMPORT_BYTES, prepareProfileImport } from "@/lib/profileImport";
import { decodeProfileSharePayload } from "@/lib/profileShare";
import ImportPreview from "./components/ImportPreview.vue";

const profilesStore = useProfilesStore();
const route = useRoute();
const router = useRouter();
const fileInputRef = useTemplateRef("fileInputRef");
const { t } = useI18n();

const userInput = ref("");
const keepEnabled = ref(false);
const busy = ref(false);
let intakeRevision = 0;
const inspection = computed(() => inspectProfileImport(userInput.value));
watch(userInput, () => {
  keepEnabled.value = false;
  intakeRevision++;
}, { flush: "sync" });
onBeforeUnmount(() => intakeRevision++);

const { validJson, formatJson } = useJsonValidation(userInput);

watch(() => route.query.profiles, async (profiles) => {
  if (typeof profiles === "string" && userInput.value === "") {
    const startedAt = ++intakeRevision;
    try {
      const decoded = await decodeProfileSharePayload(profiles);
      if (intakeRevision !== startedAt || busy.value || userInput.value !== "" || route.query.profiles !== profiles)
        return;
      userInput.value = decoded;
      userInput.value = formatJson();
    } catch (error) {
      if (intakeRevision !== startedAt)
        return;
      console.error("Failed to decode shared profiles:", error);
      toast.error(t("import.toast.invalidShareLink"), {
        description: t("import.toast.invalidShareLinkDescription"),
      });
    }
  }
}, { immediate: true });

function handleFormatJson() {
  userInput.value = formatJson();
}

async function closeImportPage() {
  userInput.value = "";
  await router.push("/");
}

async function confirmImport() {
  if (busy.value || inspection.value.status !== "ready")
    return;
  const { exchange } = inspection.value;
  const preserveEnabled = keepEnabled.value;
  const startedAt = intakeRevision;
  const importPath = route.fullPath;
  busy.value = true;
  try {
    const { profiles } = exchange;
    const hasSyncCookieGroups = profiles.some(profile => Boolean(profile.syncCookieGroups?.length));
    if (hasSyncCookieGroups && !await ensureBrowserPermission("cookies")) {
      toast.error(t("import.toast.cookiesPermissionRequired"));
      return;
    }
    if (intakeRevision !== startedAt || route.fullPath !== importPath)
      return;

    const imported = prepareProfileImport(exchange, preserveEnabled);
    profilesStore.manager = {
      ...profilesStore.manager,
      profileGroups: [...profilesStore.manager.profileGroups, ...imported.profileGroups],
      profiles: [...profilesStore.manager.profiles, ...imported.profiles],
      selectedProfileId: imported.profiles[0]!.id,
    };

    const profileCountLabel = profiles.length === 1 ? t("import.profile") : t("import.profiles");
    toast.success(t("import.toast.success", { count: profiles.length, label: profileCountLabel }));
    await router.push("/profiles");
  } catch (error) {
    console.error("Import failed:", error);
    toast.error(t("import.toast.invalidJson"));
  } finally {
    busy.value = false;
  }
}

function handleFileImport() {
  fileInputRef.value?.click();
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file || busy.value) {
    return;
  }
  if (file.size > MAX_PROFILE_IMPORT_BYTES) {
    toast.error(t("profileImport.tooLarge"));
    target.value = "";
    return;
  }

  const reader = new FileReader();
  const readSequence = ++intakeRevision;
  reader.onload = (e) => {
    if (readSequence !== intakeRevision || busy.value)
      return;
    const content = e.target?.result as string;
    userInput.value = content;
    toast.success(t("import.toast.fileLoaded"));
  };

  reader.onerror = () => {
    toast.error(t("import.toast.fileReadFailed"));
  };

  reader.readAsText(file);

  target.value = "";
}
</script>

<template>
  <div
    v-if="profilesStore.ready"
    :class="cn(
      'flex size-full items-center justify-center bg-background',
    )"
  >
    <div
      class="flex size-full flex-col overflow-y-auto bg-background"
    >
      <header
        class="
          sticky top-0 z-10 flex items-center justify-between gap-4 border-b
          bg-card p-4
        "
      >
        <h1 class="text-lg leading-none font-semibold">
          {{ t("import.title") }}
        </h1>
        <Button
          size="icon-sm"
          variant="ghost"
          :disabled="busy"
          class="
            -mr-2 opacity-70
            hover:opacity-100
          "
          @click="closeImportPage"
        >
          <i class="i-lucide-x size-4" />
          <span class="sr-only">{{ t("common.close") }}</span>
        </Button>
      </header>

      <main
        class="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <ImportPreview v-model="keepEnabled" :inspection :busy class="shrink-0" />
        <JsonEditor
          v-model="userInput"
          class="min-h-0 flex-1"
          height="100%"
          :readonly="busy"
        />
      </main>

      <footer
        class="
          sticky bottom-0 z-10 flex flex-row justify-end gap-2 border-t bg-card
          px-4 py-3
        "
      >
        <Button variant="secondary" :disabled="busy" @click="closeImportPage">
          {{ t("common.cancel") }}
        </Button>
        <Button
          data-testid="import-beautify"
          variant="secondary"
          :disabled="!validJson || busy"
          @click="handleFormatJson"
        >
          {{ t("common.beautify") }}
        </Button>
        <Button data-testid="import-file" variant="secondary" :disabled="busy" @click="handleFileImport">
          {{ t("import.loadFromFile") }}
        </Button>
        <Button
          data-testid="import-confirm"
          :disabled="inspection.status !== 'ready' || busy"
          @click="confirmImport"
        >
          {{ t("import.confirm") }}
        </Button>

        <input
          ref="fileInputRef"
          data-testid="import-file-input"
          type="file"
          accept=".json"
          class="hidden"
          @change="handleFileChange"
        >
      </footer>
    </div>
  </div>
</template>
