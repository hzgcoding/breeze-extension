<script setup lang="ts">
import { cn } from "@breeze/ui/lib/utils";
import { useProfilesStore } from "@/entrypoints/popup/stores/useProfilesStore";
import EnvironmentSwitcher from "./components/EnvironmentSwitcher.vue";
import Header from "./components/Header/index.vue";
import SelectedProfile from "./components/SelectedProfile";
import Sidebar from "./components/Sidebar";

const profilesStore = useProfilesStore();
</script>

<template>
  <div
    v-if="profilesStore.ready"
    :class="cn(
      `
        grid grid-cols-[3.5rem_minmax(0,1fr)]
        grid-rows-[4rem_auto_minmax(0,1fr)]
      `,
      'size-full',
    )"
  >
    <Sidebar class="col-start-1 row-span-3" />
    <Header class="col-start-2 row-start-1" />
    <EnvironmentSwitcher class="col-start-2 row-start-2" />
    <main
      class="
        col-start-2 row-start-3 flex flex-col overflow-x-hidden overflow-y-auto
      "
    >
      <!-- Use `key` to force refresh components to prevent `auto-animate`
         from applying animations across profiles -->
      <SelectedProfile :key="profilesStore.manager.selectedProfileId" />
    </main>
  </div>
</template>
