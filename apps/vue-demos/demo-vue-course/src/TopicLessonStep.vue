<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import { drilldownPath } from "./course";
import { TOPICS, type TopicId } from "./topics";
import { TOPIC_STEP_TO_ID } from "./course";
import type { CourseData, DrilldownData } from "./course";

const { snapshot, startSubPath } = usePathContext<CourseData>();

const topicId = computed<TopicId>(() => {
  const currentStep = snapshot.value?.stepId ?? "core-concepts-topic";
  return TOPIC_STEP_TO_ID[currentStep] ?? "core-concepts";
});

const topic = computed(() => TOPICS[topicId.value]);
const hasDrilledDown = computed(
  () => snapshot.value?.data.drilldownsCompleted[topicId.value] ?? false
);

async function openDrilldown() {
  const currentTopic = topic.value;
  const initialData: DrilldownData = {
    topicId: currentTopic.id,
    title: currentTopic.title,
    sourceDoc: currentTopic.sourceDoc,
    whyItMatters: currentTopic.drilldown.whyItMatters,
    miniExample: currentTopic.drilldown.miniExample
  };

  await startSubPath(drilldownPath, initialData, { topicId: currentTopic.id });
}
</script>

<template>
  <div class="form-body">
    <p class="doc-chip">Source: {{ topic.sourceDoc }}</p>

    <p class="step-intro">
      {{ topic.title }}
    </p>

    <ul class="bullet-list">
      <li v-for="item in topic.summary" :key="item">{{ item }}</li>
    </ul>

    <div class="drilldown-card">
      <div>
        <p class="drilldown-title">Optional Subpath Drilldown</p>
        <p class="drilldown-copy">
          Launch a short subpath for extra context. You can still continue without it.
        </p>
      </div>
      <button
        type="button"
        class="btn-secondary"
        :disabled="snapshot?.isNavigating"
        @click="openDrilldown"
      >
        Open Drilldown
      </button>
    </div>

    <p v-if="hasDrilledDown" class="status-pass">Subpath completed for this topic.</p>
  </div>
</template>

