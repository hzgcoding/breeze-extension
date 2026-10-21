<script setup lang="ts">
import { Button } from "@breeze/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@breeze/ui/components/tooltip";
import { useI18n } from "vue-i18n";

const { documentationLink, name } = defineProps<{
  documentationLink?: string;
  name: string;
}>();

const { t } = useI18n();
</script>

<template>
  <fieldset
    v-auto-animate
    :aria-label="name"
    class="rule-section grid w-full grid-cols-1 rounded-xl border bg-card"
  >
    <header
      class="
        sticky top-0 z-10 flex min-h-11 w-full items-center justify-between
        gap-2 rounded-t-xl border-b bg-card px-3 py-2 text-sm font-semibold
      "
    >
      <slot name="name-before" />
      <span data-testid="fieldset-name">{{ name }}</span>
      <div class="flex flex-1 items-center gap-1">
        <TooltipProvider v-if="documentationLink">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button as-child size="icon-xs" variant="ghost">
                <a
                  :href="documentationLink"
                  target="_blank"
                  rel="noopener noreferrer"
                  :aria-label="t('group.actions.openDocumentation')"
                >
                  <i class="i-lucide-book-open size-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {{ t("group.actions.openDocumentation") }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <slot name="group-actions">
          <span class="h-0 flex-1 border-t" />
        </slot>
      </div>
    </header>
    <div data-testid="fieldset-main" class="p-3">
      <slot name="main" />
    </div>
  </fieldset>
</template>
