export const TOPIC_IDS = ["core-concepts", "subpaths", "persistence"] as const;
export type TopicId = (typeof TOPIC_IDS)[number];

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: Array<{ id: string; label: string }>;
  correctOptionId: string;
  explanation: string;
};

export type TopicContent = {
  id: TopicId;
  title: string;
  sourceDoc: string;
  summary: string[];
  drilldown: {
    whyItMatters: string;
    miniExample: string;
  };
  quizQuestions: QuizQuestion[];
};

export const TOPICS: Record<TopicId, TopicContent> = {
  "core-concepts": {
    id: "core-concepts",
    title: "Core Concepts and Path Definitions",
    sourceDoc: "docs/guides/DEVELOPER_GUIDE.md",
    summary: [
      "Pathwrite is a headless engine: it owns navigation and data, while your app owns UI markup.",
      "A path is defined as ordered steps with optional guards and lifecycle hooks.",
      "fieldMessages can automatically derive canMoveNext when you do not provide an explicit guard."
    ],
    drilldown: {
      whyItMatters: "Separating orchestration from UI lets teams reuse the same flow logic across Angular, React, Vue, and Svelte.",
      miniExample: "Start with a PathDefinition, then render with PathShell slots. The same path can also be run in unit tests without UI."
    },
    quizQuestions: [
      {
        id: "cc-1",
        prompt: "What does headless mean in Pathwrite?",
        options: [
          { id: "a", label: "Pathwrite renders all form HTML automatically." },
          { id: "b", label: "Pathwrite controls state and flow, while your app renders UI." },
          { id: "c", label: "Pathwrite only works with Vue components." }
        ],
        correctOptionId: "b",
        explanation: "The engine is UI-agnostic; adapters expose reactive state for your components."
      },
      {
        id: "cc-2",
        prompt: "Which object describes an ordered workflow in Pathwrite?",
        options: [
          { id: "a", label: "PathDefinition" },
          { id: "b", label: "PathSnapshot" },
          { id: "c", label: "Observer" }
        ],
        correctOptionId: "a",
        explanation: "PathDefinition is the source-of-truth config for steps and guards."
      },
      {
        id: "cc-3",
        prompt: "If canMoveNext is omitted, what can block Next by default?",
        options: [
          { id: "a", label: "A non-empty fieldMessages result" },
          { id: "b", label: "The document title" },
          { id: "c", label: "Any observer callback" }
        ],
        correctOptionId: "a",
        explanation: "fieldMessages integrates with default shell behavior and guard derivation."
      }
    ]
  },
  subpaths: {
    id: "subpaths",
    title: "Subpaths for Optional Deep Dives",
    sourceDoc: "docs/guides/DEVELOPER_GUIDE.md",
    summary: [
      "startSubPath pushes the current path on a stack and activates a focused sub-flow.",
      "When the subpath finishes, parent context is restored automatically.",
      "onSubPathComplete lets the parent step merge results from the nested flow."
    ],
    drilldown: {
      whyItMatters: "Subpaths keep your primary flow clean while allowing conditional detail capture only when needed.",
      miniExample: "In approval workflows, each approver can run a personal review subpath, then return to the parent review gate."
    },
    quizQuestions: [
      {
        id: "sp-1",
        prompt: "What does startSubPath do to the parent path?",
        options: [
          { id: "a", label: "Deletes parent progress and starts over." },
          { id: "b", label: "Pauses parent flow and pushes it onto a stack." },
          { id: "c", label: "Skips directly to the final step." }
        ],
        correctOptionId: "b",
        explanation: "Subpaths are stack-based; completion resumes the parent path."
      },
      {
        id: "sp-2",
        prompt: "Which hook is used on a parent step to read finished subpath data?",
        options: [
          { id: "a", label: "onLeave" },
          { id: "b", label: "onSubPathComplete" },
          { id: "c", label: "validationMessages" }
        ],
        correctOptionId: "b",
        explanation: "onSubPathComplete receives subPathId, subPathData, parent context, and optional meta."
      },
      {
        id: "sp-3",
        prompt: "Why are subpaths useful in learning flows?",
        options: [
          { id: "a", label: "They replace all parent steps permanently." },
          { id: "b", label: "They force every learner through advanced content." },
          { id: "c", label: "They allow optional drills without bloating the main route." }
        ],
        correctOptionId: "c",
        explanation: "Learners can go deeper when they want, then continue the main path."
      }
    ]
  },
  persistence: {
    id: "persistence",
    title: "Persistence Strategies",
    sourceDoc: "docs/guides/PERSISTENCE_STRATEGY_GUIDE.md",
    summary: [
      "onNext is the default strategy and saves after successful step navigation.",
      "onEveryChange can save on each state update and should usually be debounced for text input.",
      "onSubPathComplete and onComplete are useful for checkpoint and audit-style workflows."
    ],
    drilldown: {
      whyItMatters: "Choosing the right strategy balances crash recovery, backend load, and user experience.",
      miniExample: "For long text forms, onEveryChange with debounceMs gives crash safety without flooding API calls."
    },
    quizQuestions: [
      {
        id: "ps-1",
        prompt: "Which persistence strategy is default in httpPersistence?",
        options: [
          { id: "a", label: "onEveryChange" },
          { id: "b", label: "onNext" },
          { id: "c", label: "manual" }
        ],
        correctOptionId: "b",
        explanation: "onNext is optimized for multi-step forms with fewer API writes."
      },
      {
        id: "ps-2",
        prompt: "What is the main reason to add debounce to onEveryChange?",
        options: [
          { id: "a", label: "To delay rendering of steps" },
          { id: "b", label: "To avoid many rapid save calls while typing" },
          { id: "c", label: "To disable local state updates" }
        ],
        correctOptionId: "b",
        explanation: "Debounce collapses bursty input updates into fewer saves."
      },
      {
        id: "ps-3",
        prompt: "Which strategy is best when you only want a final audit record?",
        options: [
          { id: "a", label: "onComplete" },
          { id: "b", label: "onSubPathComplete" },
          { id: "c", label: "onEveryChange" }
        ],
        correctOptionId: "a",
        explanation: "onComplete writes once at the end and keeps the final state for review."
      }
    ]
  }
};

