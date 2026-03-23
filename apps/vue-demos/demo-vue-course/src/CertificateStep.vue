<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import { TOPIC_IDS, TOPICS } from "./topics";
import type { CourseData } from "./course";

const { snapshot } = usePathContext<CourseData>();

const data = computed(() => snapshot.value?.data);
</script>

<template>
  <div class="certificate-card">
    <p class="certificate-kicker">Pathwrite Academy</p>
    <h2>Certificate of Completion</h2>
    <p>This certifies that</p>
    <p class="signature">{{ data?.fullName || "Student" }}</p>
    <p>has completed the Pathwrite developer course and is hereby recognized as</p>
    <p class="certified">Certified Pathwriter</p>

    <p class="certificate-topics-title">Topics covered</p>
    <ul class="topic-list">
      <li v-for="topicId in TOPIC_IDS" :key="topicId">
        <span>{{ TOPICS[topicId].title }}</span>
        <strong>{{ data?.quizScores?.[topicId] ?? 0 }}%</strong>
      </li>
    </ul>
  </div>
</template>

