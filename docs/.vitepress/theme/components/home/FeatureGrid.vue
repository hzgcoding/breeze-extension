<script setup lang="ts">
import { withBase } from "vitepress";

const features = [
  { title: "Request and response headers", description: "Set, append, or remove headers to test authentication, feature flags, and response behavior.", icon: "i-lucide-list-filter", href: "/guides/modify-request-headers" },
  { title: "Request routing", description: "Redirect a complete URL, block or allow requests, and upgrade HTTP URLs to HTTPS.", icon: "i-lucide-corner-up-right", href: "/reference/actions/" },
  { title: "Focused conditions", description: "Match URLs, domains, methods, and resource types, or apply a profile to selected tabs and tab groups.", icon: "i-lucide-crosshair", href: "/reference/conditions/" },
  { title: "Environment switching", description: "Use profile groups to switch between environments or combine several rules for one workflow.", icon: "i-lucide-panels-top-left", href: "/reference/profile-groups" },
  { title: "Cookie synchronization", description: "With your permission, append a selected local cookie to matching requests and keep its value synchronized.", icon: "i-lucide-refresh-cw", href: "/guides/sync-cookies" },
  { title: "Portable profiles", description: "Import cURL commands, export JSON backups, or share profiles with credential values cleared by default.", icon: "i-lucide-message-square-share", href: "/guides/import-export-share" },
];
</script>

<template>
  <div
    class="
      mt-10 grid gap-x-12 gap-y-0
      max-sm:mt-9
      md:grid-cols-2
    "
  >
    <a
      v-for="feature in features"
      :key="feature.href" :href="withBase(feature.href)" class="
        group flex flex-col border-t border-border pt-7 pb-8
        max-sm:py-6
      "
    >
      <i class="mb-4 size-5 text-brand" :class="feature.icon" aria-hidden="true" />
      <h3
        class="
          text-lg/snug font-medium tracking-tight transition
          group-hover:text-brand
        "
      >
        {{ feature.title }}
      </h3>
      <p
        class="mt-3 max-w-md text-sm/relaxed text-muted-foreground"
      >
        {{ feature.description }}
      </p>
    </a>
  </div>
</template>
