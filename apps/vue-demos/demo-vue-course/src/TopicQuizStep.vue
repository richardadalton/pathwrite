<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import { QUIZ_STEP_TO_ID, getQuizScore, type CourseData } from "./course";
import { TOPICS, type TopicId } from "./topics";

const { snapshot, setData } = usePathContext<CourseData>();

const topicId = computed<TopicId>(() => {
  const currentStep = snapshot.value?.stepId ?? "core-concepts-quiz";
  return QUIZ_STEP_TO_ID[currentStep] ?? "core-concepts";
});

const topic = computed(() => TOPICS[topicId.value]);
const score = computed(() =>
  snapshot.value ? getQuizScore(topicId.value, snapshot.value.data) : 0
);

const attempted = computed(() => snapshot.value?.hasAttemptedNext ?? false);

function getAnswer(questionId: string): string {
  return snapshot.value?.data.quizAnswers?.[topicId.value]?.[questionId] ?? "";
}

function answerQuestion(questionId: string, optionId: string) {
  const currentAnswers = snapshot.value?.data.quizAnswers;
  if (!currentAnswers) return;

  setData("quizAnswers", {
    ...currentAnswers,
    [topicId.value]: {
      ...(currentAnswers[topicId.value] ?? {}),
      [questionId]: optionId
    }
  });
}
</script>

<template>
  <div class="form-body">
    <p class="step-intro">Quiz: {{ topic.title }}</p>

    <div v-for="question in topic.quizQuestions" :key="question.id" class="quiz-card">
      <p class="quiz-question">{{ question.prompt }}</p>
      <label
        v-for="option in question.options"
        :key="option.id"
        class="quiz-option"
      >
        <input
          type="radio"
          :name="question.id"
          :checked="getAnswer(question.id) === option.id"
          @change="answerQuestion(question.id, option.id)"
        />
        <span>{{ option.label }}</span>
      </label>
      <p
        v-if="getAnswer(question.id) === question.correctOptionId"
        class="status-pass"
      >
        {{ question.explanation }}
      </p>
    </div>

    <p class="score-pill" :class="score > 70 ? 'score-pill--pass' : 'score-pill--fail'">
      Current score: {{ score }}% (must be greater than 70%)
    </p>

    <p v-if="attempted && score <= 70" class="field-error">
      Keep going - update your answers until your score is above 70%.
    </p>
  </div>
</template>


