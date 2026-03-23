<script setup lang="ts">
import { computed } from "vue";
import type { PathSnapshot, StepStatus } from "@daltonr/pathwrite-vue";
import { TOPICS, type TopicId } from "./topics";

type MilestoneId = "profile" | TopicId | "certificate";

type Milestone = {
  id: MilestoneId;
  title: string;
  stepIds: string[];
};

const props = defineProps<{ snapshot: PathSnapshot }>();

const milestones: Milestone[] = [
  { id: "profile", title: "Profile", stepIds: ["full-name"] },
  {
    id: "core-concepts",
    title: TOPICS["core-concepts"].title,
    stepIds: ["core-concepts-topic", "core-concepts-quiz"]
  },
  {
    id: "subpaths",
    title: TOPICS.subpaths.title,
    stepIds: ["subpaths-topic", "subpaths-quiz"]
  },
  {
    id: "persistence",
    title: TOPICS.persistence.title,
    stepIds: ["persistence-topic", "persistence-quiz"]
  },
  { id: "certificate", title: "Certificate", stepIds: ["certificate"] }
];

const stepToMilestone = new Map<string, MilestoneId>();
for (const milestone of milestones) {
  for (const stepId of milestone.stepIds) {
    stepToMilestone.set(stepId, milestone.id);
  }
}

const rootStepId = computed(() => {
  const root = props.snapshot.rootProgress;
  if (!root) return props.snapshot.stepId;
  return root.steps[root.stepIndex]?.id ?? props.snapshot.stepId;
});

const activeMilestoneId = computed<MilestoneId>(() =>
  stepToMilestone.get(rootStepId.value) ?? "profile"
);

const courseStepStatuses = computed(() => {
  const source = props.snapshot.rootProgress?.steps ?? props.snapshot.steps;
  return new Map(source.map((step) => [step.id, step.status as StepStatus]));
});

function milestoneState(id: MilestoneId): "completed" | "current" | "upcoming" {
  const milestone = milestones.find((entry) => entry.id === id);
  if (!milestone) return "upcoming";

  const statuses = milestone.stepIds
    .map((stepId) => courseStepStatuses.value.get(stepId))
    .filter((status): status is StepStatus => !!status);

  if (statuses.length === 0) {
    return id === activeMilestoneId.value ? "current" : "upcoming";
  }

  if (statuses.some((status) => status === "current")) return "current";
  if (statuses.every((status) => status === "completed")) return "completed";
  return "upcoming";
}

const completedCount = computed(() =>
  milestones.filter((milestone) => milestoneState(milestone.id) === "completed").length
);

const activeIndex = computed(() =>
  Math.max(0, milestones.findIndex((milestone) => milestone.id === activeMilestoneId.value))
);
</script>

<template>
  <div class="milestone-header">
    <div class="milestone-header__top">
      <p class="milestone-header__eyebrow">Course milestones</p>
      <p class="milestone-header__meta">
        Module {{ activeIndex + 1 }} of {{ milestones.length }}
      </p>
    </div>

    <div class="milestone-track" role="list" aria-label="Course milestones">
      <div
        v-for="(milestone, index) in milestones"
        :key="milestone.id"
        class="milestone-item"
        :class="`milestone-item--${milestoneState(milestone.id)}`"
        role="listitem"
      >
        <span class="milestone-item__dot">{{ milestoneState(milestone.id) === "completed" ? "✓" : index + 1 }}</span>
        <span class="milestone-item__label">{{ milestone.title }}</span>
      </div>
    </div>

    <div class="milestone-progress">
      <div class="milestone-progress__track">
        <div
          class="milestone-progress__fill"
          :style="{ width: `${(completedCount / milestones.length) * 100}%` }"
        />
      </div>
    </div>
  </div>
</template>


