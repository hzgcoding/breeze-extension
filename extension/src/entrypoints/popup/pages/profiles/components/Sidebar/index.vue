<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import type { RuleActionType } from "@/lib/schema";
import Badge from "@breeze/ui/components/badge/Badge.vue";
import { Button } from "@breeze/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@breeze/ui/components/dropdown-menu";
import { Label } from "@breeze/ui/components/label";
import { Switch } from "@breeze/ui/components/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@breeze/ui/components/tooltip";
import { cn } from "@breeze/ui/lib/utils";

import { useStorage } from "@vueuse/core";
import { match } from "ts-pattern";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import BrandMark from "#/components/BrandMark.vue";
import { useRuleActionType } from "#/composables/useRuleActionType";
import { useTinykeys } from "@/composables/useTinykeys";
import { useProfilesStore } from "@/entrypoints/popup/stores/useProfilesStore";
import { useSettingsStore } from "@/entrypoints/popup/stores/useSettingsStore";
import ProfileSwitcher from "./components/ProfileSwitcher.vue";

const { class: className } = defineProps<{
  class?: HTMLAttributes["class"];
}>();

const profilesStore = useProfilesStore();
const settingsStore = useSettingsStore();
const { t } = useI18n();
const router = useRouter();
const ruleActionTypeMap = useRuleActionType();

const defaultRuleActionType = useStorage<RuleActionType>("default-rule-action-type", "modifyHeaders");

function openInFullscreen() {
  browser.tabs.create({ url: browser.runtime.getURL("/popup.html") });
}

const menuOpen = ref(false);

function quickCreateProfile() {
  void profilesStore.addProfile(defaultRuleActionType.value);
  menuOpen.value = false;
}

function openSettings() {
  void router.push("/settings");
  menuOpen.value = false;
}

const quickCreateShortcutKeys = useTinykeys(window, "$mod+N", (event) => {
  event.preventDefault();
  if (!event.repeat) {
    quickCreateProfile();
  }
});

const settingsShortcutKeys = useTinykeys(window, "$mod+,", (event) => {
  event.preventDefault();
  if (!event.repeat) {
    openSettings();
  }
});

const ruleActionTypes = [
  "modifyHeaders",
  "block",
  "allow",
  "upgradeScheme",
  "allowAllRequests",
  "redirect",
] as const satisfies RuleActionType[];

function getRuleActionTypeDocumentationLink(type: RuleActionType) {
  return match(type)
    .with("modifyHeaders", () => "https://hzgcoding.github.io/breeze/reference/actions/modify-headers")
    .with("block", () => "https://hzgcoding.github.io/breeze/reference/actions/block")
    .with("allow", () => "https://hzgcoding.github.io/breeze/reference/actions/allow")
    .with("upgradeScheme", () => "https://hzgcoding.github.io/breeze/reference/actions/upgrade-scheme")
    .with("allowAllRequests", () => "https://hzgcoding.github.io/breeze/reference/actions/allow-all-requests")
    .with("redirect", () => "https://hzgcoding.github.io/breeze/reference/actions/redirect")
    .exhaustive();
}
</script>

<template>
  <aside
    :class="cn(
      `
        workspace-rail flex h-full flex-col justify-between border-r bg-sidebar
        py-2
      `,
      className,
    )"
  >
    <DropdownMenu v-model:open="menuOpen">
      <DropdownMenuTrigger as-child>
        <Button
          variant="secondary"
          size="icon-sm"
          :class="cn(
            `mx-auto`,
            settingsStore.powerOn || 'opacity-60',
          )"
        >
          <BrandMark class="size-7 text-primary" />
          <span class="sr-only">{{ t("profile.sidebar.openMenu") }}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent class="min-w-40" align="end" :collision-padding="8">
        <DropdownMenuGroup>
          <DropdownMenuItem class="justify-between gap-2" @click="quickCreateProfile">
            <span>{{ t("profile.sidebar.quickCreate") }}</span>
            <DropdownMenuShortcut>
              {{ quickCreateShortcutKeys.join("+") }}
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {{ t("profile.sidebar.newProfile") }}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent class="min-w-40">
              <DropdownMenuSub
                v-for="type in ruleActionTypes"
                :key="type"
              >
                <DropdownMenuSubTrigger
                  class="cursor-pointer justify-between gap-2"
                  hide-arrow
                  @click="() => {
                    profilesStore.addProfile(type)
                    menuOpen = false
                  }"
                >
                  {{ ruleActionTypeMap[type].label }}
                  <a
                    :href="getRuleActionTypeDocumentationLink(type)"
                    target="_blank"
                    rel="noopener noreferrer"
                    :aria-label="t('group.actions.openDocumentation')"
                    class="
                      flex items-center justify-center rounded-sm
                      text-muted-foreground transition
                      hover:text-foreground
                    "
                    @click.stop
                  >
                    <i class="i-lucide-circle-question-mark size-4" />
                  </a>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem v-if="type !== defaultRuleActionType" @click="defaultRuleActionType = type">
                    {{ t("profile.sidebar.makeDefault") }}
                  </DropdownMenuItem>
                  <DropdownMenuItem v-else disabled class="opacity-100!">
                    <Badge>
                      {{ t("profile.sidebar.defaultActionType") }}
                    </Badge>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {{ t("profile.sidebar.profiles") }}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem as-child>
                <RouterLink to="/import">
                  <i class="i-lucide-upload size-4 shrink-0" />
                  {{ t("common.import") }}
                </RouterLink>
              </DropdownMenuItem>
              <DropdownMenuItem as-child>
                <RouterLink to="/export">
                  <i class="i-lucide-share-2 size-4 shrink-0" />
                  {{ t("common.share") }}
                </RouterLink>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem class="gap-2" @click="openSettings">
            <span>{{ t("common.settings") }}</span>
            <DropdownMenuShortcut>
              {{ settingsShortcutKeys.join("+") }}
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {{ t("profile.sidebar.resources") }}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem as-child>
                <a href="https://hzgcoding.github.io/breeze/start/overview" target="_blank">
                  <i class="i-lucide-book-open size-4 shrink-0" />
                  {{ t("profile.sidebar.documentation") }}
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem as-child>
                <a href="https://github.com/hzgcoding/breeze" target="_blank">
                  <i class="i-lucide-github size-4 shrink-0" />
                  {{ t("common.github") }}
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem as-child>
                <a href="https://github.com/hzgcoding/breeze/blob/main/extension/CHANGELOG.md" target="_blank">
                  <i class="i-lucide-scroll-text size-4 shrink-0" />
                  {{ t("profile.sidebar.changelog") }}
                </a>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem @click="openInFullscreen">
            {{ t("profile.sidebar.openInTab") }}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
    <div
      class="
        flex h-4 items-center self-stretch
        before:h-px before:w-full before:grow before:bg-border
        before:content-['']
      "
    />
    <div
      :class="cn(
        'flex flex-1 flex-col overflow-y-hidden',
        settingsStore.powerOn || `opacity-60`,
      )"
    >
      <ProfileSwitcher :default-rule-action-type />
    </div>

    <div
      class="
        flex h-4 items-center self-stretch
        before:h-px before:w-full before:grow before:bg-border
        before:content-['']
      "
    />

    <div class="flex flex-col items-center">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Label class="size-8">
              <Switch
                v-model="settingsStore.powerOn"
                data-testid="extension-power"
                class="data-[state=checked]:bg-brand!"
              />
            </Label>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{{ settingsStore.powerOn ? t("profile.sidebar.turnOff") : t("profile.sidebar.turnOn") }}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </aside>
</template>
