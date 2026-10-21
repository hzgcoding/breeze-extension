<script setup lang="ts">
import type { HeaderMod } from "@/lib/schema";

import type { ActionType, HeaderModOperation } from "@/lib/types";
import { Button } from "@breeze/ui/components/button";
import {
  Combobox,
  ComboboxAnchor,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxViewport,
} from "@breeze/ui/components/combobox";
import { Textarea } from "@breeze/ui/components/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@breeze/ui/components/tooltip";
import { cn } from "@breeze/ui/lib/utils";
import { useDebounceFn } from "@vueuse/core";
import { match } from "ts-pattern";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import ActionsDropdown from "#/components/group/FieldActionsDropdown.vue";
import {
  AUTOCOMPLETE_APPEND_REQUEST_FIELDS,
  AUTOCOMPLETE_RESPONSE_FIELDS,
  AUTOCOMPLETE_SET_AND_REMOVE_REQUEST_FIELDS,
} from "@/entrypoints/popup/constants/header";
import { isValidHeaderName, isValidHeaderValue } from "@/lib/headerInput";

const list = defineModel<HeaderMod[]>("list", {
  required: true,
});

const field = defineModel<HeaderMod>("field", {
  required: true,
});

const { actionType, index } = defineProps<{
  actionType: ActionType;
  index: number;
}>();

const emit = defineEmits<{
  (e: "nameCommitted", name: string): void;
}>();

const { t } = useI18n();
const nameDraft = ref(field.value.name);
const valueDraft = ref(field.value.operation === "remove" ? "" : field.value.value ?? "");
const operationDraft = ref(field.value.operation);
const rejectedNamePaste = ref(false);
const invalidName = computed(() => rejectedNamePaste.value || !isValidHeaderName(nameDraft.value));
const invalidValue = computed(() => operationDraft.value !== "remove" && !isValidHeaderValue(valueDraft.value));
const hasValidSavedHeader = computed(() => isValidHeaderName(field.value.name)
  && (field.value.operation === "remove"
    || (isValidHeaderValue(field.value.value ?? "") && (field.value.value ?? "").trim().length > 0)));

watch(() => field.value.name, (name) => {
  nameDraft.value = name;
  rejectedNamePaste.value = false;
});
watch(() => field.value.operation === "remove" ? undefined : field.value.value, (value) => {
  if (value !== undefined)
    valueDraft.value = value;
});
watch(() => field.value.operation, (operation) => {
  operationDraft.value = operation;
});

const emitRecentHeaderName = useDebounceFn((name: string) => {
  if (isValidHeaderName(name) && field.value.name === name && nameDraft.value === name)
    emit("nameCommitted", name);
}, 500);

function commitHeaderName(name: string) {
  rejectedNamePaste.value = false;
  nameDraft.value = name;
  commitDraft();
}

function commitHeaderValue(value: string | number) {
  valueDraft.value = String(value);
  commitDraft();
}

function commitDraft() {
  if (invalidName.value || invalidValue.value)
    return;

  const { id, enabled, comments } = field.value;
  const base = { id, enabled, comments, name: nameDraft.value };
  field.value = operationDraft.value === "remove"
    ? { ...base, operation: "remove" }
    : { ...base, operation: operationDraft.value, value: valueDraft.value };
  emitRecentHeaderName(nameDraft.value);
}

function handleHeaderNameInput(event: Event) {
  commitHeaderName((event.target as HTMLInputElement).value);
}

function handleHeaderNamePaste(event: ClipboardEvent) {
  if (isValidHeaderValue(event.clipboardData?.getData("text/plain") ?? ""))
    return;
  event.preventDefault();
  rejectedNamePaste.value = true;
}

function getAutocompleteList(actionType: ActionType, operation: HeaderModOperation) {
  if (actionType === "response") {
    return AUTOCOMPLETE_RESPONSE_FIELDS;
  } else if (operation === "append") {
    return AUTOCOMPLETE_APPEND_REQUEST_FIELDS;
  } else {
    return AUTOCOMPLETE_SET_AND_REMOVE_REQUEST_FIELDS;
  }
}

const autocompleteList = computed(() => {
  const query = nameDraft.value.toLowerCase();
  const list = getAutocompleteList(actionType, operationDraft.value);
  if (!query)
    return list;
  return list.filter(item => item.toLowerCase().includes(query) && item !== nameDraft.value);
});

const nextOperation = computed(() => {
  const supportedOperations = ["set", "append", "remove"] as const satisfies HeaderModOperation[];
  const currentIndex = supportedOperations.indexOf(operationDraft.value);
  const nextIndex = (currentIndex + 1) % supportedOperations.length;
  return {
    value: supportedOperations[nextIndex]!,
    label: getOperationLabel(supportedOperations[nextIndex]!),
  };
});

function changeOperation() {
  operationDraft.value = nextOperation.value.value;
  commitDraft();
}

function getOperationLabel(operation: HeaderModOperation) {
  return match(operation)
    .with("set", () => t("headerMod.operation.set"))
    .with("append", () => t("headerMod.operation.append"))
    .with("remove", () => t("headerMod.operation.remove"))
    .exhaustive();
}
</script>

<template>
  <div
    class="
      flex flex-1 flex-col items-end justify-between gap-1
      sm:flex-row sm:items-center
    "
  >
    <div class="flex w-full flex-1">
      <slot name="field-before" />
      <div
        class="
          grid flex-1 flex-col gap-1
          sm:grid-cols-2 sm:grid-rows-1
        "
      >
        <Combobox
          :model-value="nameDraft"
          :class="cn('flex-1', operationDraft === 'remove' && `col-span-2`)"
        >
          <ComboboxAnchor class="w-full">
            <ComboboxInput
              :model-value="nameDraft"
              :data-testid="`header-name-${field.id}`"
              :placeholder="t('common.name')"
              :aria-label="t('common.name')"
              :aria-invalid="invalidName"
              :aria-describedby="invalidName ? `header-name-error-${field.id}` : undefined"
              :class="cn('w-full font-mono text-xs', invalidName && `
                border-destructive
              `)"
              @input="handleHeaderNameInput"
              @paste="handleHeaderNamePaste"
            />
          </ComboboxAnchor>

          <ComboboxList v-if="autocompleteList.length > 0">
            <ComboboxViewport>
              <ComboboxItem
                v-for="option in autocompleteList"
                :key="option"
                :value="option"
                @select="commitHeaderName(option)"
              >
                {{ option }}
              </ComboboxItem>
            </ComboboxViewport>
          </ComboboxList>
          <p
            v-if="invalidName"
            :id="`header-name-error-${field.id}`"
            :data-testid="`header-name-error-${field.id}`"
            class="mt-1 text-xs text-destructive"
            role="alert"
          >
            {{ t("headerInput.invalidName") }}
            <span v-if="hasValidSavedHeader" class="block">{{ t("headerInput.savedHeaderKept") }}</span>
          </p>
        </Combobox>
        <div v-if="operationDraft !== 'remove'" class="flex-1">
          <Textarea
            :model-value="valueDraft"
            :data-testid="`header-value-${field.id}`"
            :rows="1"
            class="min-h-9 resize-none py-2 font-mono text-xs"
            :placeholder="t('common.value')"
            :aria-label="t('common.value')"
            :aria-invalid="invalidValue"
            :aria-describedby="invalidValue ? `header-value-error-${field.id}` : undefined"
            @update:model-value="commitHeaderValue"
          />
          <p
            v-if="invalidValue"
            :id="`header-value-error-${field.id}`"
            :data-testid="`header-value-error-${field.id}`"
            class="mt-1 text-xs text-destructive"
            role="alert"
          >
            {{ t("headerInput.invalidValue") }}
            <span v-if="hasValidSavedHeader" class="block">{{ t("headerInput.savedHeaderKept") }}</span>
          </p>
        </div>
      </div>
    </div>
    <div class="flex items-center gap-0.5">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon-xs"
              variant="secondary"
              :class="cn(`whitespace-nowrap`)"
              @click="changeOperation"
            >
              <i
                :class="cn('size-4', {
                  'i-lucide-equal': operationDraft === 'set',
                  'i-lucide-plus': operationDraft === 'append',
                  'i-lucide-minus': operationDraft === 'remove',
                })"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" :collision-padding="20">
            <p>{{ t("headerMod.currentOperation", { operation: getOperationLabel(operationDraft) }) }}</p>
            <p>{{ t("headerMod.switchTo", { operation: nextOperation.label }) }}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Button
        size="icon-xs"
        variant="secondary"
        @click="() => {
          list.splice(index, 1);
        }"
      >
        <span class="sr-only">{{ t("common.deleteHeaderMod") }}</span>
        <i class="i-lucide-x size-4" />
      </Button>
      <ActionsDropdown
        v-model:list="list"
        v-model:field="field"
        :index
      />
    </div>
  </div>
</template>
