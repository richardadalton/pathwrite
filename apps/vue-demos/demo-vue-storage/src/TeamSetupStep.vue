<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { WizardData, Person } from "./wizard";

const { snapshot, setData } = usePathContext<WizardData>();

const teamName = computed(() => (snapshot.value?.data.teamName as string) ?? "");
const members  = computed(() => (snapshot.value?.data.members  ?? []) as Person[]);
const errors   = computed(() => snapshot.value?.fieldMessages ?? {});
const attempted = computed(() => snapshot.value?.hasAttemptedNext ?? false);

function updateTeamName(value: string) {
  setData("teamName", value);
}

function addMember() {
  setData("members", [...members.value, { name: "", role: "" }]);
}

function removeMember(index: number) {
  setData("members", members.value.filter((_, i) => i !== index));
}

function updateMemberName(index: number, value: string) {
  setData("members", members.value.map((m, i) => i === index ? { ...m, name: value } : m));
}

function updateMemberRole(index: number, value: string) {
  setData("members", members.value.map((m, i) => i === index ? { ...m, role: value } : m));
}
</script>

<template>
  <div class="form-body">
    <p class="step-intro">
      Enter your team's name and add everyone you'll be onboarding. You'll fill in a detailed
      profile for each person on the next step.
    </p>

    <!-- Team name -->
    <div class="field" :class="{ 'field--error': attempted && errors.teamName }">
      <label for="team-name">
        Team Name <span class="required">*</span>
      </label>
      <input
        id="team-name"
        type="text"
        placeholder="e.g. Platform Engineering"
        :value="teamName"
        @input="updateTeamName(($event.target as HTMLInputElement).value)"
      />
      <p v-if="attempted && errors.teamName" class="field-error">{{ errors.teamName }}</p>
    </div>

    <!-- Members list -->
    <div>
      <div class="members-header">
        <p class="section-label">Team Members <span class="required">*</span></p>
        <button type="button" class="btn-add" @click="addMember">+ Add Member</button>
      </div>

      <div v-if="members.length === 0" class="empty-members">
        <span class="empty-members__icon">👥</span>
        <p>No members yet. Click <strong>+ Add Member</strong> to get started.</p>
      </div>

      <div class="member-list">
        <div v-for="(member, i) in members" :key="i" class="member-row">
          <span class="member-number">{{ i + 1 }}</span>
          <div class="member-fields">
            <input
              type="text"
              placeholder="Full name *"
              :value="member.name"
              @input="updateMemberName(i, ($event.target as HTMLInputElement).value)"
              class="member-name-input"
              :class="{ 'input--error': attempted && !member.name.trim() }"
            />
            <input
              type="text"
              placeholder="Role / title (optional)"
              :value="member.role"
              @input="updateMemberRole(i, ($event.target as HTMLInputElement).value)"
              class="member-role-input"
            />
          </div>
          <button
            type="button"
            class="btn-remove"
            @click="removeMember(i)"
            title="Remove member"
          >✕</button>
        </div>
      </div>

      <p v-if="attempted && errors.members" class="field-error">{{ errors.members }}</p>
    </div>
  </div>
</template>

