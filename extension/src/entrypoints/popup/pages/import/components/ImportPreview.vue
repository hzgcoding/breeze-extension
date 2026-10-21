<script setup lang="ts">
import type { ProfileImportInspection } from "@/lib/profileImport";
import { Checkbox } from "@breeze/ui/components/checkbox";
import { Label } from "@breeze/ui/components/label";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const keepEnabled = defineModel<boolean>({ default: false });
const { inspection, busy } = defineProps<{ inspection: ProfileImportInspection; busy: boolean }>();
const { t } = useI18n();
const rows = computed(() => inspection.status === "ready" ? inspection.exchange.profiles.slice(0, 30) : []);
const actionNames = computed(() => ({
  modifyHeaders: t("profileImport.actions.modifyHeaders"),
  redirect: t("profileImport.actions.redirect"),
  block: t("profileImport.actions.block"),
  allow: t("profileImport.actions.allow"),
  allowAllRequests: t("profileImport.actions.allowAllRequests"),
  upgradeScheme: t("profileImport.actions.upgradeScheme"),
}));
</script>

<template>
  <section
    v-if="inspection.status !== 'empty'" class="
      space-y-2 border-b px-4 py-3 text-sm
    " data-testid="import-preflight"
  >
    <h2 class="font-medium">
      {{ t("profileImport.title") }}
    </h2>
    <p v-if="inspection.status === 'invalidJson'" class="text-destructive" role="alert">
      {{ t("profileImport.invalidJson") }}
    </p>
    <p v-else-if="inspection.status === 'tooLarge'" class="text-destructive" role="alert">
      {{ t("profileImport.tooLarge") }}
    </p>
    <div
      v-else-if="inspection.status === 'invalid'" class="
        space-y-1 text-destructive
      " data-testid="import-errors" role="alert"
    >
      <p>{{ t("profileImport.invalid") }}</p>
      <ul class="max-h-24 overflow-auto font-mono text-xs">
        <li v-for="(issue, index) in inspection.issues.slice(0, 20)" :key="index">
          {{ `${issue.path}: ${issue.message}` }}
        </li>
      </ul>
    </div>
    <template v-else-if="inspection.status === 'ready'">
      <p data-testid="import-summary">
        {{ t("profileImport.summary", {
          profiles: inspection.exchange.profiles.length,
          groups: inspection.exchange.version === 2 ? inspection.exchange.profileGroups.length : 0,
          enabled: inspection.enabledCount,
        }) }}
      </p>
      <div class="max-h-32 overflow-auto rounded-md border">
        <table class="w-full text-left text-xs">
          <thead class="bg-muted text-muted-foreground">
            <tr>
              <th class="px-2 py-1">
                {{ t("common.name") }}
              </th>
              <th class="px-2 py-1">
                {{ t("profileImport.action") }}
              </th>
              <th class="px-2 py-1">
                {{ t("profileImport.domains") }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(profile, index) in rows" :key="index" class="border-t">
              <td class="px-2 py-1 break-all">
                {{ profile.name }}
              </td>
              <td class="px-2 py-1">
                {{ actionNames[profile.ruleActionType] }}
              </td>
              <td class="px-2 py-1 break-all">
                {{ profile.filters.requestDomains?.items.filter(item => item.enabled && item.value.trim()).map(item => item.value).join(", ") || t("profileImport.unrestrictedDomains") }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-if="inspection.exchange.profiles.length > rows.length" class="
          text-xs text-muted-foreground
        "
      >
        {{ t("profileImport.firstRows", { count: rows.length }) }}
      </p>
      <div class="flex items-center gap-2">
        <Checkbox id="import-keep-enabled" v-model="keepEnabled" :disabled="busy" data-testid="import-keep-enabled" />
        <Label for="import-keep-enabled">{{ t("profileImport.keepEnabled") }}</Label>
      </div>
      <p class="text-xs text-muted-foreground" data-testid="import-activation-note">
        {{ keepEnabled ? t("profileImport.enabledNote") : t("profileImport.pausedNote") }}
      </p>
    </template>
  </section>
</template>
