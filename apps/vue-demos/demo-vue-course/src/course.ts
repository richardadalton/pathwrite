import type { PathDefinition, PathStepContext } from "@daltonr/pathwrite-vue";
import { TOPIC_IDS, TOPICS, type TopicId } from "./topics";

export type CourseData = {
  fullName: string;
  drilldownsCompleted: Record<TopicId, boolean>;
  quizAnswers: Record<TopicId, Record<string, string>>;
  quizScores: Record<TopicId, number>;
  completedTopics: TopicId[];
};

export type DrilldownData = {
  topicId: TopicId;
  title: string;
  sourceDoc: string;
  whyItMatters: string;
  miniExample: string;
};

const TOPIC_STEP_IDS: Record<TopicId, string> = {
  "core-concepts": "core-concepts-topic",
  subpaths: "subpaths-topic",
  persistence: "persistence-topic"
};

const QUIZ_STEP_IDS: Record<TopicId, string> = {
  "core-concepts": "core-concepts-quiz",
  subpaths: "subpaths-quiz",
  persistence: "persistence-quiz"
};

export const TOPIC_STEP_TO_ID = Object.fromEntries(
  TOPIC_IDS.map((topicId) => [TOPIC_STEP_IDS[topicId], topicId])
) as Record<string, TopicId>;

export const QUIZ_STEP_TO_ID = Object.fromEntries(
  TOPIC_IDS.map((topicId) => [QUIZ_STEP_IDS[topicId], topicId])
) as Record<string, TopicId>;

function makeTopicRecord<T>(factory: () => T): Record<TopicId, T> {
  return TOPIC_IDS.reduce((acc, topicId) => {
    acc[topicId] = factory();
    return acc;
  }, {} as Record<TopicId, T>);
}

export const INITIAL_DATA: CourseData = {
  fullName: "",
  drilldownsCompleted: makeTopicRecord(() => false),
  quizAnswers: makeTopicRecord(() => ({})),
  quizScores: makeTopicRecord(() => 0),
  completedTopics: []
};

export function getQuizScore(topicId: TopicId, data: CourseData): number {
  const topic = TOPICS[topicId];
  const answers = data.quizAnswers[topicId] ?? {};
  const correct = topic.quizQuestions.filter(
    (question) => answers[question.id] === question.correctOptionId
  ).length;

  return Math.round((correct / topic.quizQuestions.length) * 100);
}

function hasPassedTopic(topicId: TopicId, data: CourseData): boolean {
  return getQuizScore(topicId, data) > 70;
}

function updateCompletedTopics(ctx: PathStepContext<CourseData>, topicId: TopicId): CourseData["completedTopics"] {
  const existing = ctx.data.completedTopics ?? [];
  if (hasPassedTopic(topicId, ctx.data)) {
    return Array.from(new Set([...existing, topicId]));
  }
  return existing.filter((entry) => entry !== topicId);
}

function makeTopicStep(topicId: TopicId): PathDefinition<CourseData>["steps"][number] {
  return {
    id: TOPIC_STEP_IDS[topicId],
    title: TOPICS[topicId].title,
    onSubPathComplete(_subPathId, _subPathData, ctx, meta) {
      const resolvedTopic = (meta?.topicId as TopicId | undefined) ?? topicId;
      return {
        drilldownsCompleted: {
          ...ctx.data.drilldownsCompleted,
          [resolvedTopic]: true
        }
      };
    }
  };
}

function makeQuizStep(topicId: TopicId): PathDefinition<CourseData>["steps"][number] {
  return {
    id: QUIZ_STEP_IDS[topicId],
    title: `${TOPICS[topicId].title} Quiz`,
    canMoveNext: ({ data }) => hasPassedTopic(topicId, data),
    fieldMessages: ({ data }) => {
      const score = getQuizScore(topicId, data);
      return {
        _: score > 70 ? undefined : `Score ${score}%. You need more than 70% to continue.`
      };
    },
    onLeave(ctx) {
      return {
        quizScores: {
          ...ctx.data.quizScores,
          [topicId]: getQuizScore(topicId, ctx.data)
        },
        completedTopics: updateCompletedTopics(ctx, topicId)
      };
    }
  };
}

export const drilldownPath: PathDefinition<DrilldownData> = {
  id: "course-drilldown",
  title: "Topic Drilldown",
  steps: [
    {
      id: "drill-overview",
      title: "Why It Matters"
    },
    {
      id: "drill-example",
      title: "Implementation Sketch"
    }
  ]
};

export const coursePath: PathDefinition<CourseData> = {
  id: "pathwrite-academy",
  title: "Pathwrite Academy",
  steps: [
    {
      id: "full-name",
      title: "Student Name",
      fieldMessages: ({ data }) => {
        const parts = data.fullName.trim().split(/\s+/).filter(Boolean);
        return {
          fullName: parts.length < 2 ? "Please enter your full name (first and last name)." : undefined
        };
      }
    },
    ...TOPIC_IDS.flatMap((topicId) => [makeTopicStep(topicId), makeQuizStep(topicId)]),
    {
      id: "certificate",
      title: "Graduation Certificate",
      canMoveNext: ({ data }) => TOPIC_IDS.every((topicId) => hasPassedTopic(topicId, data))
    }
  ]
};

