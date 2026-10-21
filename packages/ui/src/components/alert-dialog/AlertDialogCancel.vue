<script setup lang="ts">
import type { AlertDialogCancelProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { buttonVariants } from "@breeze/ui/components/button";
import { cn } from "@breeze/ui/lib/utils";
import { reactiveOmit } from "@vueuse/core";
import { AlertDialogCancel } from "reka-ui";

const props = defineProps<AlertDialogCancelProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = reactiveOmit(props, "class");
</script>

<template>
  <AlertDialogCancel
    v-bind="delegatedProps"
    :class="cn(
      buttonVariants({ variant: 'secondary' }),
      `
        mt-2
        sm:mt-0
      `,
      props.class,
    )"
  >
    <slot />
  </AlertDialogCancel>
</template>
