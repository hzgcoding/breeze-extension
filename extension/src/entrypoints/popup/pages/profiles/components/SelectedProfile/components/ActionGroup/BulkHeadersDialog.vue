<script setup lang="ts">
import type { HeaderModGroup } from "@/lib/schema";
import { Button } from "@breeze/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@breeze/ui/components/dialog";
import { Label } from "@breeze/ui/components/label";
import { Textarea } from "@breeze/ui/components/textarea";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { parseHeaderLines } from "@/lib/headerInput";
import { createHeaderMod } from "@/lib/profileFactory";

const group = defineModel<HeaderModGroup>({ required: true });
const emit = defineEmits<{
  (e: "added", names: string[]): void;
}>();

const { t } = useI18n();
const open = ref(false);
const input = ref("");
const parsed = computed(() => parseHeaderLines(input.value));
const canInsert = computed(() => parsed.value.headers.length > 0 && parsed.value.errors.length === 0);

function insertHeaders() {
  if (!canInsert.value)
    return;

  const headers = parsed.value.headers.map(({ name, value }) => createHeaderMod({
    name,
    value,
    enabled: group.value.type === "checkbox",
  }));
  group.value.items.push(...headers);
  emit("added", headers.map(header => header.name));
  open.value = false;
  input.value = "";
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button
        :data-testid="`header-bulk-open-${group.id}`"
        size="icon-xs"
        variant="secondary"
        :aria-label="t('headerInput.pasteHeaders')"
        :title="t('headerInput.pasteHeaders')"
      >
        <i class="i-lucide-clipboard-paste size-4" />
      </Button>
    </DialogTrigger>
    <DialogContent
      class="
        max-h-[90dvh] overflow-y-auto
        sm:max-w-xl
      "
    >
      <DialogHeader>
        <DialogTitle>{{ t("headerInput.pasteHeaders") }}</DialogTitle>
        <DialogDescription>{{ t("headerInput.description") }}</DialogDescription>
      </DialogHeader>
      <div class="grid min-w-0 gap-3">
        <Label :for="`header-bulk-input-${group.id}`">{{ t("headerInput.headersLabel") }}</Label>
        <Textarea
          :id="`header-bulk-input-${group.id}`"
          v-model="input"
          data-testid="header-bulk-input"
          class="min-h-32 font-mono text-xs"
          :placeholder="t('headerInput.placeholder')"
          :aria-invalid="parsed.errors.length > 0"
          :aria-describedby="parsed.errors.length > 0 ? `header-bulk-errors-${group.id}` : undefined"
          autofocus
        />
        <ul
          v-if="parsed.errors.length > 0"
          :id="`header-bulk-errors-${group.id}`"
          data-testid="header-bulk-errors"
          class="space-y-1 text-xs text-destructive"
          role="alert"
        >
          <li v-for="error in parsed.errors" :key="error.line">
            <template v-if="error.reason === 'missingColon'">
              {{ t("headerInput.lineMissingColon", { line: error.line }) }}
            </template>
            <template v-else-if="error.reason === 'invalidName'">
              {{ t("headerInput.lineInvalidName", { line: error.line }) }}
            </template>
            <template v-else>
              {{ t("headerInput.lineInvalidValue", { line: error.line }) }}
            </template>
          </li>
        </ul>
        <div v-if="parsed.headers.length > 0" class="min-w-0 space-y-2">
          <p class="text-sm font-medium">
            {{ t("headerInput.preview", { count: parsed.headers.length }) }}
          </p>
          <div class="max-h-48 overflow-auto rounded-md border">
            <table
              data-testid="header-bulk-preview" class="w-full text-left text-xs"
            >
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
                  v-for="header in parsed.headers" :key="header.line" class="
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
                    <span
                      v-if="!header.value.trim()"
                      :data-testid="`header-bulk-empty-${header.line}`"
                      class="block font-sans text-muted-foreground"
                    >{{ t("headerInput.emptyValueWarning") }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p v-if="group.type === 'radio'" class="text-xs text-muted-foreground">
          {{ t("headerInput.radioDescription") }}
        </p>
      </div>
      <DialogFooter class="flex flex-row justify-end gap-2">
        <DialogClose as-child>
          <Button variant="secondary">
            {{ t("common.cancel") }}
          </Button>
        </DialogClose>
        <Button data-testid="header-bulk-confirm" :disabled="!canInsert" @click="insertHeaders">
          {{ t("headerInput.insert", { count: parsed.headers.length }) }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
