<script setup lang="ts">
import { Button } from "@breeze/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@breeze/ui/components/dialog";
import { Label } from "@breeze/ui/components/label";
import { Textarea } from "@breeze/ui/components/textarea";
import { match } from "ts-pattern";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useProfilesStore } from "@/entrypoints/popup/stores/useProfilesStore";
import { createCurlProfile, parseCurl } from "@/lib/curlImport";

const { t } = useI18n();
const profilesStore = useProfilesStore();
const open = ref(false);
const input = ref("");
const parsed = computed(() => parseCurl(input.value));
const error = computed(() => {
  const result = parsed.value;
  if (result.ok || result.error === "empty")
    return "";
  return match(result.error)
    .with("syntax", () => t("curlImport.errorSyntax"))
    .with("command", () => t("curlImport.errorCommand"))
    .with("option", () => t("curlImport.errorOption"))
    .with("url", () => t("curlImport.errorUrl"))
    .with("header", () => t("curlImport.errorHeader"))
    .with("method", () => t("curlImport.errorMethod"))
    .with("file", () => t("curlImport.errorFile"))
    .exhaustive();
});
watch(open, (value) => {
  if (!value)
    input.value = "";
});
function importProfile() {
  if (!parsed.value.ok)
    return;
  const profile = createCurlProfile(parsed.value);
  profilesStore.manager.profiles.push(profile);
  profilesStore.manager.selectedProfileId = profile.id;
  open.value = false;
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button data-testid="curl-import-open" size="icon-sm" variant="ghost" :aria-label="t('curlImport.title')" :title="t('curlImport.title')">
        <i class="i-lucide-terminal size-4" />
      </Button>
    </DialogTrigger>
    <DialogContent
      class="
        max-h-[90dvh] overflow-y-auto
        sm:max-w-xl
      "
    >
      <DialogHeader>
        <DialogTitle>{{ t("curlImport.title") }}</DialogTitle>
        <DialogDescription>{{ t("curlImport.description") }}</DialogDescription>
      </DialogHeader>
      <div class="grid min-w-0 gap-3">
        <Label for="curl-import-input">{{ t("curlImport.inputLabel") }}</Label>
        <Textarea
          id="curl-import-input"
          v-model="input"
          data-testid="curl-import-input"
          class="min-h-32 font-mono text-xs"
          :placeholder="t('curlImport.placeholder')"
          :aria-invalid="!!error"
          :aria-describedby="error ? 'curl-import-error' : undefined"
          autofocus
          spellcheck="false"
          autocomplete="off"
        />
        <p
          v-if="error" id="curl-import-error" data-testid="curl-import-error" class="
            text-xs text-destructive
          " role="alert"
        >
          {{ error }}
        </p>
        <template v-if="parsed.ok">
          <div data-testid="curl-import-preview" class="min-w-0 space-y-2">
            <p class="text-sm font-medium">
              {{ t("curlImport.scope", { domain: parsed.domain, method: parsed.method.toUpperCase() }) }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ t("curlImport.scopeDescription") }}
            </p>
            <div class="max-h-48 overflow-auto rounded-md border">
              <table class="w-full text-left text-xs">
                <thead class="bg-muted text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2 font-medium">
                      {{ t("common.name") }}
                    </th>
                    <th class="px-3 py-2 font-medium">
                      {{ t("common.value") }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="header in parsed.headers" :key="header.name.toLowerCase()" class="
                      border-t
                    "
                  >
                    <td class="px-3 py-2 align-top font-mono break-all">
                      {{ header.name }}
                    </td>
                    <td
                      class="
                        px-3 py-2 align-top font-mono break-all
                        whitespace-pre-wrap
                      "
                    >
                      {{ header.value }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <ul
            v-if="parsed.warnings.length" data-testid="curl-import-warnings" class="
              list-inside list-disc space-y-1 text-xs text-muted-foreground
            "
          >
            <li v-if="parsed.warnings.includes('body')">
              {{ t("curlImport.warningBody") }}
            </li>
            <li v-if="parsed.warnings.includes('network')">
              {{ t("curlImport.warningNetwork") }}
            </li>
            <li v-if="parsed.warnings.includes('duplicate')">
              {{ t("curlImport.warningDuplicate") }}
            </li>
          </ul>
          <p class="text-xs text-muted-foreground">
            {{ t("curlImport.pausedDescription") }}
          </p>
        </template>
      </div>
      <DialogFooter class="flex flex-row justify-end gap-2">
        <DialogClose as-child>
          <Button variant="ghost">
            {{ t("common.cancel") }}
          </Button>
        </DialogClose>
        <Button data-testid="curl-import-confirm" :disabled="!parsed.ok" @click="importProfile">
          {{ t("curlImport.confirm") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
