<script setup lang="ts">
import { ref } from "vue";
import { PathShell } from "@daltonr/pathwrite-vue";
import type { PathData } from "@daltonr/pathwrite-vue";
import { INITIAL_DATA, coursePath } from "./course";
import { TOPIC_IDS, TOPICS } from "./topics";
import type { CourseData } from "./course";
import NameStep from "./NameStep.vue";
import TopicLessonStep from "./TopicLessonStep.vue";
import TopicQuizStep from "./TopicQuizStep.vue";
import DrilldownOverviewStep from "./DrilldownOverviewStep.vue";
import DrilldownExampleStep from "./DrilldownExampleStep.vue";
import CertificateStep from "./CertificateStep.vue";
import CourseMilestoneHeader from "./CourseMilestoneHeader.vue";

const graduateData = ref<CourseData | null>(null);

function handleComplete(data: PathData) {
  graduateData.value = data as CourseData;
}

function resetCourse() {
  graduateData.value = null;
}
</script>

<template>
  <main class="page">
    <header class="page-header">
      <p class="eyebrow">Pathwrite Academy</p>
      <h1>Developer E-Learning Course</h1>
      <p class="subtitle">
        Learn Pathwrite with guided topics, optional subpath drills, and score-gated quizzes.
      </p>
    </header>

    <section v-if="graduateData" class="result-panel success-panel">
      <div class="result-icon">Awarded</div>
      <h2>Certified Pathwriter</h2>
      <p>
        Congratulations, <span class="signature">{{ graduateData.fullName }}</span>.
      </p>
      <ul class="topic-list topic-list--final">
        <li v-for="topicId in TOPIC_IDS" :key="topicId">
          <strong>{{ TOPICS[topicId].title }}</strong>
          <span>{{ graduateData.quizScores[topicId] ?? 0 }}%</span>
        </li>
      </ul>
      <button class="btn-primary" @click="resetCourse">Run Course Again</button>
    </section>

    <PathShell
      v-else
      :path="coursePath"
      :initial-data="INITIAL_DATA"
      complete-label="Graduate"
      cancel-label="Exit"
      @complete="handleComplete"
    >
      <template #header="{ snapshot }"><CourseMilestoneHeader :snapshot="snapshot" /></template>

      <template #full-name><NameStep /></template>

      <template #core-concepts-topic><TopicLessonStep /></template>
      <template #core-concepts-quiz><TopicQuizStep /></template>

      <template #subpaths-topic><TopicLessonStep /></template>
      <template #subpaths-quiz><TopicQuizStep /></template>

      <template #persistence-topic><TopicLessonStep /></template>
      <template #persistence-quiz><TopicQuizStep /></template>

      <template #certificate><CertificateStep /></template>

      <template #drill-overview><DrilldownOverviewStep /></template>
      <template #drill-example><DrilldownExampleStep /></template>
    </PathShell>
  </main>
</template>

