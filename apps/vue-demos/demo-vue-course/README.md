# demo-vue-course

**Pathwrite Academy - Vue E-Learning Demo**

A Vue 3 course app that teaches Pathwrite with topic lessons, optional subpath drilldowns, and score-gated quizzes.

## What this demo includes

- Student onboarding screen that requires a full name
- Three course topics sourced from `docs/guides/*`
- Optional drilldown lessons launched via `startSubPath()`
- Quiz after each topic
- Progress gate: score must be **more than 70%** to continue
- Final certificate page with learner signature styling and covered topics list

## Course flow

1. `full-name`
2. `core-concepts-topic` -> `core-concepts-quiz`
3. `subpaths-topic` -> `subpaths-quiz`
4. `persistence-topic` -> `persistence-quiz`
5. `certificate`

Subpath steps:

- `drill-overview`
- `drill-example`

## Run locally

```bash
npm install
npm run start
```

Open [http://localhost:5173](http://localhost:5173).

## Key files

- `src/course.ts` - Path definitions, quiz gating, and subpath completion handling
- `src/topics.ts` - Topic content and quizzes derived from docs
- `src/TopicLessonStep.vue` - Main topic view + drilldown launcher
- `src/TopicQuizStep.vue` - Quiz UI and answer capture
- `src/CertificateStep.vue` - Final course certificate

