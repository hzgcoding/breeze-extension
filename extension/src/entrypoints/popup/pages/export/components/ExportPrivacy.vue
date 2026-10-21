<script setup lang="ts">
import { Checkbox } from "@breeze/ui/components/checkbox";
import { Label } from "@breeze/ui/components/label";
import { useI18n } from "vue-i18n";

const retainSensitive = defineModel<boolean>({ required: true });
defineProps<{ count: number; names: string[]; busy: boolean; valid: boolean }>();
const { t } = useI18n();
</script>

<template>
  <section class="space-y-1 border-b bg-muted/40 px-3 py-2 text-xs" data-testid="export-privacy">
    <Label class="flex items-center gap-2 text-sm">
      <Checkbox v-model="retainSensitive" data-testid="export-retain-sensitive" :disabled="busy" />
      {{ t("exportPrivacy.retain") }}
    </Label>
    <p v-if="count" data-testid="export-privacy-summary" class="wrap-break-word">
      {{ t("exportPrivacy.summary", { count, names: names.join(', ') }) }}
    </p>
    <p
      :class="retainSensitive ? `
        text-amber-700
        dark:text-amber-400
      ` : `text-muted-foreground`"
    >
      {{ retainSensitive ? t("exportPrivacy.included") : t("exportPrivacy.redacted") }}
      {{ t("exportPrivacy.cookies") }}
    </p>
    <p class="text-muted-foreground">
      {{ t("exportPrivacy.warning") }}
    </p>
    <p v-if="!valid" class="text-destructive">
      {{ t("exportPrivacy.invalid") }}
    </p>
  </section>
</template>
