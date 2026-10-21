<script setup lang="ts">
import type { AlertDialogActionProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { buttonVariants } from "@breeze/ui/components/button";
import { cn } from "@breeze/ui/lib/utils";
import { reactiveOmit } from "@vueuse/core";
import { AlertDialogAction } from "reka-ui";

const props = defineProps<AlertDialogActionProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = reactiveOmit(props, "class");
</script>

<template>
  <AlertDialogAction v-bind="delegatedProps" :class="cn(buttonVariants(), props.class)">
    <slot />
  </AlertDialogAction>
</template>
