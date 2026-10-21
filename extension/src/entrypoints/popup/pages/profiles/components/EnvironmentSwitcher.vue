<script setup lang="ts">
import { Button } from "@breeze/ui/components/button";
import { Checkbox } from "@breeze/ui/components/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@breeze/ui/components/dialog";
import { Input } from "@breeze/ui/components/input";
import { Label } from "@breeze/ui/components/label";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useProfilesStore } from "#/stores/useProfilesStore";
import { createEnvironmentGroup, selectEnvironment } from "@/lib/environments";

const profilesStore = useProfilesStore();
const { t } = useI18n();
const open = ref(false);
const name = ref("");
const memberIds = ref<string[]>([]);
const groups = computed(() => profilesStore.profileGroups.filter(group => group.type === "radio"));
const valid = computed(() => Boolean(name.value.trim()) && memberIds.value.length >= 2);

function beginCreate(value: boolean) {
  open.value = value;
  if (value) {
    name.value = t("environments.defaultName");
    memberIds.value = [profilesStore.manager.selectedProfileId];
  }
}

function toggleMember(id: string, checked: boolean) {
  memberIds.value = checked ? [...new Set([...memberIds.value, id])] : memberIds.value.filter(memberId => memberId !== id);
}

function createGroup() {
  if (valid.value && createEnvironmentGroup(profilesStore.manager, name.value, memberIds.value))
    open.value = false;
}
</script>

<template>
  <section
    class="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2.5" :aria-label="t('environments.title')"
  >
    <label
      v-for="group in groups" :key="group.id" class="
        flex min-w-0 items-center gap-2 text-xs
      "
    >
      <span class="max-w-24 truncate font-medium">{{ group.name || t("environments.defaultName") }}</span>
      <select
        :data-testid="`environment-select-${group.id}`"
        :aria-label="t('environments.select', { name: group.name })"
        :value="profilesStore.manager.profiles.find(profile => profile.groupId === group.id && profile.enabled)?.id ?? ''"
        class="
          h-7 max-w-44 rounded-md border bg-background px-2 text-xs outline-none
          focus-visible:ring-2 focus-visible:ring-ring
        "
        @change="selectEnvironment(profilesStore.manager, group.id, ($event.target as HTMLSelectElement).value || undefined)"
      >
        <option value="">{{ t("environments.off") }}</option>
        <option v-for="profile in profilesStore.manager.profiles.filter(profile => profile.groupId === group.id)" :key="profile.id" :value="profile.id">
          {{ profile.name }}
        </option>
      </select>
    </label>
    <span
      v-if="groups.length === 0" class="flex-1 text-xs text-muted-foreground"
    >{{ t("environments.hint") }}</span>
    <Dialog :open @update:open="beginCreate">
      <DialogTrigger as-child>
        <Button
          data-testid="environment-create" size="sm" variant="outline" class="
            ml-auto h-7 text-xs
          " :disabled="profilesStore.manager.profiles.length < 2"
        >
          <i class="i-lucide-layers size-3.5" />
          {{ t("environments.create") }}
        </Button>
      </DialogTrigger>
      <DialogContent
        class="
          max-h-[90vh] overflow-y-auto
          sm:max-w-md
        "
      >
        <DialogHeader>
          <DialogTitle>{{ t("environments.create") }}</DialogTitle>
          <DialogDescription>{{ t("environments.description") }}</DialogDescription>
        </DialogHeader>
        <div class="grid gap-3">
          <Label for="environment-name">{{ t("environments.name") }}</Label>
          <Input id="environment-name" v-model="name" data-testid="environment-name" />
          <div class="grid max-h-64 gap-2 overflow-y-auto">
            <Label
              v-for="profile in profilesStore.manager.profiles" :key="profile.id" class="
                flex items-center gap-2 rounded-md border p-2
              "
            >
              <Checkbox :data-testid="`environment-member-${profile.id}`" :model-value="memberIds.includes(profile.id)" @update:model-value="toggleMember(profile.id, $event === true)" />
              <span class="min-w-0 truncate">{{ profile.name }}</span>
            </Label>
          </div>
          <p class="text-xs text-muted-foreground">
            {{ t("environments.selectionHint") }}
          </p>
        </div>
        <DialogFooter>
          <DialogClose as-child>
            <Button variant="secondary">
              {{ t("common.cancel") }}
            </Button>
          </DialogClose>
          <Button data-testid="environment-save" :disabled="!valid" @click="createGroup">
            {{ t("common.save") }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>
