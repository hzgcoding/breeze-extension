<script setup lang="ts">
import { Button } from "@breeze/ui/components/button";
import { withBase } from "vitepress";
import { RELEASES_URL } from "../../../../extension/src/lib/product";

defineProps<{ centered?: boolean }>();
</script>

<template>
  <div class="vp-raw flex flex-wrap items-center gap-3" :class="{ 'justify-center': centered }">
    <Button
      as="a" :href="RELEASES_URL" target="_blank" rel="noopener noreferrer"
      class="h-11 gap-2 rounded-lg px-5 text-sm no-underline"
    >
      <i class="i-lucide-download size-4" aria-hidden="true" />
      Download ZIP
    </Button>
    <Button
      as="a" :href="withBase('/start/installation')" variant="outline"
      class="h-11 rounded-lg px-5 text-sm no-underline"
    >
      Installation guide
    </Button>
  </div>
</template>
