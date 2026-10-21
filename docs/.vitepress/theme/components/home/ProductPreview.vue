<script setup lang="ts">
import { withBase } from "vitepress";
import largeDarkScreenshot from "../../assets/popup-screenshot-large-dark.webp";
import largeLightScreenshot from "../../assets/popup-screenshot-large-light.webp";
import smallDarkScreenshot from "../../assets/popup-screenshot-small-dark.webp";
import smallLightScreenshot from "../../assets/popup-screenshot-small-light.webp";
</script>

<template>
  <figure class="mx-auto mb-12 w-full max-w-210">
    <div
      class="
        overflow-hidden rounded-xl border border-border bg-card
        shadow-[0_16px_48px_-24px_rgb(0_0_0/20%)]
      "
    >
      <div
        class="
          flex items-center gap-2 border-b border-border px-4 py-3 text-xs
          text-muted-foreground
        " aria-hidden="true"
      >
        <img
          :src="withBase('/images/breeze.svg')" alt="" width="16" height="16" class="
            no-zoom
          "
        >
        Breeze / Profiles
      </div>
      <!-- Theme visibility follows VitePress's pre-paint .dark class, including saved preferences. -->
      <picture
        class="
          block
          dark:hidden
        "
      >
        <source media="(max-width: 640px)" :srcset="smallLightScreenshot" width="600" height="560">
        <img
          fetchpriority="high"
          :src="largeLightScreenshot" width="1200" height="800" alt="Breeze profile editor with request headers, response headers, and domain conditions." class="
            block h-auto w-full
          "
        >
      </picture>
      <picture
        class="
          hidden
          dark:block
        "
      >
        <source media="(max-width: 640px)" :srcset="smallDarkScreenshot" width="600" height="560">
        <img
          fetchpriority="high"
          :src="largeDarkScreenshot" width="1200" height="800" alt="Breeze profile editor with request headers, response headers, and domain conditions." class="
            block h-auto w-full
          "
        >
      </picture>
    </div>
  </figure>
</template>
