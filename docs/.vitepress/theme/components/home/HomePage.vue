<script setup lang="ts">
import { withBase } from "vitepress";
import DownloadButtons from "../DownloadButtons.vue";
import FeatureGrid from "./FeatureGrid.vue";
import GitHubButton from "./GitHubButton.vue";
import ProductPreview from "./ProductPreview.vue";
</script>

<template>
  <main
    class="
      vp-raw mx-auto max-w-6xl px-10 text-foreground
      **:focus-visible:rounded-sm **:focus-visible:outline-2
      **:focus-visible:outline-offset-4 **:focus-visible:outline-ring
      max-sm:px-6
    "
  >
    <section
      aria-labelledby="hero-title" class="
        pt-16
        sm:pt-24
      "
    >
      <div class="mx-auto mb-12 max-w-3xl text-center">
        <p
          class="
            mb-5 flex items-center justify-center gap-3 text-sm font-medium
            text-brand
          "
        >
          <img
            :src="withBase('/images/breeze.svg')" alt="" width="32" height="32" class="
              no-zoom
            "
          >
          Breeze · 微风
        </p>
        <h1
          id="hero-title" class="
            text-4xl/tight font-semibold tracking-tight
            sm:text-6xl/tight
          "
        >
          A workspace for your<br class="max-sm:hidden"> browser’s network rules.
        </h1>
        <p
          class="
            mx-auto mt-6 max-w-2xl text-base/relaxed text-muted-foreground
            sm:text-lg/relaxed
          "
        >
          Edit HTTP headers, route requests, and switch environments with reusable profiles.
          Keep your everyday development setup close at hand.
        </p>
        <div class="mt-8">
          <DownloadButtons centered />
        </div>
        <p class="mt-4 text-xs text-muted-foreground">
          Open source · Chrome 145+ · Install from a release ZIP
        </p>
      </div>
      <ProductPreview />
    </section>

    <section
      aria-labelledby="capabilities-title" class="
        border-t border-border py-14
        sm:py-20
      "
    >
      <div
        class="
          flex items-end justify-between gap-6
          max-sm:block
        "
      >
        <div>
          <p class="mb-3 text-sm font-medium text-brand">
            Built for browser development
          </p>
          <h2
            id="capabilities-title" class="
              text-3xl/tight font-semibold tracking-tight
            "
          >
            Configure once. Use it every day.
          </h2>
        </div>
        <a
          :href="withBase('/start/first-profile')"
          class="
            inline-flex items-center gap-2 text-sm font-medium text-brand
            max-sm:mt-5
          "
        >Create your first profile <i class="i-lucide-arrow-right size-4" aria-hidden="true" /></a>
      </div>
      <FeatureGrid />
    </section>

    <section
      aria-labelledby="privacy-title"
      class="
        grid gap-8 rounded-xl border border-border bg-muted/40 p-8
        sm:grid-cols-2 sm:gap-16 sm:p-10
      "
    >
      <div>
        <p class="mb-3 text-sm font-medium text-brand">
          Local by default
        </p>
        <h2
          id="privacy-title" class="text-3xl/tight font-semibold tracking-tight"
        >
          Your setup stays in your browser.
        </h2>
        <a
          :href="withBase('/explanation/privacy-model')"
          class="
            mt-6 inline-flex items-center gap-2 text-sm font-medium text-brand
          "
        >Read the privacy model <i class="i-lucide-arrow-right size-4" aria-hidden="true" /></a>
      </div>
      <div class="space-y-6 text-sm/relaxed text-muted-foreground">
        <p>
          Profiles and settings are stored locally. Breeze does not automatically upload them
          or require an account.
        </p>
        <p>
          Your browser applies declarative rules. Breeze does not proxy traffic or read request
          and response bodies. Cookie synchronization asks for separate permission.
        </p>
      </div>
    </section>

    <section
      aria-labelledby="start-title"
      class="
        flex items-center justify-between gap-8 py-14
        max-sm:flex-col max-sm:items-start
        sm:py-20
      "
    >
      <div>
        <h2 id="start-title" class="text-2xl font-semibold tracking-tight">
          Start with one useful rule.
        </h2>
        <p class="mt-3 text-sm text-muted-foreground">
          Download Breeze, load it in Chrome, and create your first profile.
        </p>
      </div>
      <DownloadButtons />
    </section>

    <footer
      class="
        flex flex-wrap items-center justify-between gap-5 border-t border-border
        py-6 text-sm text-muted-foreground
      "
    >
      <a
        :href="withBase('/')" class="
          inline-flex items-center gap-2 font-medium text-foreground
        "
      >
        <img
          :src="withBase('/images/breeze.svg')" alt="" width="24" height="24" class="
            no-zoom
          "
        >
        Breeze · 微风
      </a>
      <nav aria-label="Footer" class="flex items-center gap-5">
        <a :href="withBase('/start/overview')" class="hover:text-brand">Documentation</a>
        <a
          :href="withBase('/explanation/privacy-model')" class="
            hover:text-brand
          "
        >Privacy</a>
        <GitHubButton />
      </nav>
    </footer>
  </main>
</template>
