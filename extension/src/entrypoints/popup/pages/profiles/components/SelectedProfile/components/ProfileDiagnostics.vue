<script setup lang="ts">
import { Input } from "@breeze/ui/components/input";
import { match } from "ts-pattern";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useProfilesStore } from "#/stores/useProfilesStore";
import { useSettingsStore } from "#/stores/useSettingsStore";
import { checkProfileUrl, getPotentialHeaderConflicts, getProfileStatus } from "@/lib/profileDiagnostics";

const profilesStore = useProfilesStore();
const settingsStore = useSettingsStore();
const { t } = useI18n();
const requestUrl = ref("");
watch(() => profilesStore.selectedProfile.id, () => requestUrl.value = "");

const status = computed(() => getProfileStatus(profilesStore.selectedProfile, {
  powerOn: settingsStore.powerOn,
  registered: Boolean(profilesStore.profileId2RelatedRuleIdRecord[profilesStore.selectedProfile.id]),
  error: profilesStore.profileId2ErrorMessageRecord[profilesStore.selectedProfile.id],
}));
const statusLabel = computed(() => match(status.value)
  .with("global-off", () => t("diagnostics.status.globalOff"))
  .with("paused", () => t("diagnostics.status.paused"))
  .with("invalid-operations", () => t("diagnostics.status.invalidOperations"))
  .with("no-active-operations", () => t("diagnostics.status.noActiveOperations"))
  .with("registration-error", () => t("diagnostics.status.registrationError"))
  .with("pending", () => t("diagnostics.status.pending"))
  .with("registered", () => t("diagnostics.status.registered"))
  .exhaustive());
const result = computed(() => requestUrl.value.trim()
  ? checkProfileUrl(profilesStore.selectedProfile, requestUrl.value)
  : undefined);
const resultLabel = computed(() => {
  if (!result.value)
    return "";
  return match(result.value.status)
    .with("invalid-url", () => t("diagnostics.result.invalidUrl"))
    .with("no-active-operations", () => t("diagnostics.result.noActiveOperations"))
    .with("excluded-domain", () => t("diagnostics.result.excludedDomain"))
    .with("outside-domains", () => t("diagnostics.result.outsideDomains"))
    .with("domain-match", () => t("diagnostics.result.domainMatch"))
    .with("unknown", () => t("diagnostics.result.unknown"))
    .exhaustive();
});
const limitations = computed(() => (result.value?.limitations ?? []).map(limitation => match(limitation)
  .with("url-pattern", () => t("diagnostics.limits.urlPattern"))
  .with("regex", () => t("diagnostics.limits.regex"))
  .with("initiator", () => t("diagnostics.limits.initiator"))
  .with("top-frame", () => t("diagnostics.limits.topFrame"))
  .with("party", () => t("diagnostics.limits.party"))
  .with("resource", () => t("diagnostics.limits.resource"))
  .with("method", () => t("diagnostics.limits.method"))
  .with("tab", () => t("diagnostics.limits.tab"))
  .with("domain-syntax", () => t("diagnostics.limits.domainSyntax"))
  .with("url-scheme", () => t("diagnostics.limits.urlScheme"))
  .with("invalid-operations", () => t("diagnostics.limits.invalidOperations"))
  .exhaustive()));
const conflicts = computed(() => getPotentialHeaderConflicts(profilesStore.selectedProfile, profilesStore.manager.profiles));
</script>

<template>
  <details
    data-testid="profile-diagnostics" class="
      diagnostics-panel mx-3 mt-3 space-y-2 rounded-lg border bg-card px-3
      py-2.5 text-xs
      min-[900px]:mx-6 min-[900px]:mt-6
    "
  >
    <summary
      data-testid="profile-diagnostics-toggle" class="
        flex cursor-pointer flex-wrap items-center justify-between gap-2
      "
    >
      <h2 class="flex items-center gap-1 font-medium">
        <i class="i-lucide-chevron-down size-3.5" aria-hidden="true" />
        {{ t("diagnostics.title") }}
      </h2>
      <span v-if="conflicts.length" class="text-destructive" :title="t('diagnostics.conflictsTitle')">
        <i class="i-lucide-triangle-alert size-3.5" aria-hidden="true" />
        {{ conflicts.length }}
      </span>
      <span
        data-testid="profile-diagnostics-status" class="
          rounded-md bg-muted px-2 py-1 font-medium
        " :data-status="status" role="status"
      >
        {{ statusLabel }}
      </span>
    </summary>
    <p class="text-muted-foreground">
      {{ t("diagnostics.registrationNotice") }}
    </p>
    <label for="diagnostics-request-url" class="block font-medium">{{ t("diagnostics.urlLabel") }}</label>
    <Input
      id="diagnostics-request-url"
      v-model="requestUrl"
      data-testid="profile-diagnostics-url"
      :placeholder="t('diagnostics.urlPlaceholder')"
      autocomplete="off"
      spellcheck="false"
      aria-describedby="diagnostics-local-notice"
    />
    <p id="diagnostics-local-notice" class="text-muted-foreground">
      {{ t("diagnostics.localNotice") }}
    </p>
    <div
      v-if="result" data-testid="profile-diagnostics-result" class="space-y-1" role="status"
    >
      <p class="font-medium">
        {{ resultLabel }}
      </p>
      <ul
        v-if="limitations.length" class="
          list-disc space-y-1 pl-4 text-muted-foreground
        "
      >
        <li v-for="limitation in limitations" :key="limitation">
          {{ limitation }}
        </li>
      </ul>
    </div>
    <div
      v-if="conflicts.length" data-testid="profile-diagnostics-conflicts" class="
        space-y-1 rounded-sm bg-muted p-2
      "
    >
      <p class="font-medium">
        {{ t("diagnostics.conflictsTitle") }}
      </p>
      <p class="text-muted-foreground">
        {{ t("diagnostics.conflictsNotice") }}
      </p>
      <ul class="list-disc space-y-1 pl-4">
        <li v-for="conflict in conflicts" :key="`${conflict.profileId}-${conflict.scope}-${conflict.headerName}`">
          {{ conflict.scope === 'request'
            ? t("diagnostics.requestConflict", { name: conflict.profileName, header: conflict.headerName })
            : t("diagnostics.responseConflict", { name: conflict.profileName, header: conflict.headerName }) }}
        </li>
      </ul>
    </div>
  </details>
</template>
