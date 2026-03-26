<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import { memberProfileSubPath } from "./wizard";
import type { WizardData, Person, MemberProfile, ProfileSubData } from "./wizard";

const { snapshot, startSubPath } = usePathContext<WizardData>();

const members  = computed(() => (snapshot.value?.data.members  ?? []) as Person[]);
const profiles = computed(() => (snapshot.value?.data.profiles ?? {}) as Record<string, MemberProfile>);
const errors   = computed(() => snapshot.value?.fieldErrors ?? {});
const attempted = computed(() => snapshot.value?.hasAttemptedNext ?? false);

function getProfile(index: number): MemberProfile | null {
  return profiles.value[String(index)] ?? null;
}

const allDone = computed(() =>
  members.value.length > 0 &&
  members.value.every((_, i) => !!getProfile(i)?.department)
);

async function openProfile(member: Person, index: number) {
  const existing = getProfile(index);
  const initialData: ProfileSubData = {
    memberName:  member.name,
    memberRole:  member.role,
    memberIndex: index,
    department: existing?.department ?? "",
    startDate:  existing?.startDate  ?? "",
    bio:        existing?.bio        ?? "",
    goals30:    existing?.goals30    ?? "",
    goals90:    existing?.goals90    ?? "",
  };
  // meta.memberIndex is forwarded to onSubPathComplete so the parent
  // knows which profile slot to update without embedding it in the data.
  await startSubPath(memberProfileSubPath, initialData, { memberIndex: index });
}
</script>

<template>
  <div class="form-body">
    <p class="step-intro">
      Complete a profile for each team member. Click <strong>Fill in Profile</strong> to open a
      short two-step wizard, then return here when done. You can edit any profile before moving on.
    </p>

    <div class="profile-list">
      <div
        v-for="(member, i) in members"
        :key="i"
        class="profile-item"
        :class="{ 'profile-item--done': !!getProfile(i) }"
      >
        <span class="member-avatar">{{ member.name.charAt(0).toUpperCase() }}</span>

        <div class="profile-item-info">
          <span class="profile-item-name">{{ member.name }}</span>
          <span v-if="member.role" class="profile-item-role">{{ member.role }}</span>
        </div>

        <!-- Completed state -->
        <template v-if="getProfile(i)">
          <div class="profile-done-meta">
            <span class="profile-done-dept">{{ getProfile(i)!.department }}</span>
            <span class="profile-done-badge">✓ Done</span>
          </div>
          <button
            type="button"
            class="btn-edit"
            :disabled="snapshot?.isNavigating"
            @click="openProfile(member, i)"
          >Edit</button>
        </template>

        <!-- Pending state -->
        <template v-else>
          <button
            type="button"
            class="btn-fill"
            :disabled="snapshot?.isNavigating"
            @click="openProfile(member, i)"
          >Fill in Profile →</button>
        </template>
      </div>
    </div>

    <p v-if="allDone" class="gate-done">
      ✓ All {{ members.length }} profiles complete — click Next to review.
    </p>
    <p v-else-if="attempted && errors._" class="gate-pending">
      ⏳ {{ errors._ }}
    </p>
  </div>
</template>

