/**
 * demo-lifecycle
 *
 * Uses @pathwrite/core as a pure backend state machine to model a document
 * lifecycle — no UI, no framework adapters, just data transitions with guards,
 * hooks, sub-paths, and conditional skipping.
 *
 * Lifecycle:  Draft → Review → Approved → Published
 *
 * Three scenarios are run:
 *   1. Happy path     — document flows straight through to Published.
 *   2. Rejection      — reviewer rejects; document returns to Draft, then succeeds.
 *   3. Auto-skip      — an internal memo skips Review entirely.
 */

import { PathData, PathDefinition, PathEngine, PathEvent } from "@pathwrite/core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocData extends PathData {
  title: string;
  body: string;
  docType: "standard" | "memo";
  reviewOutcome: "pending" | "approved" | "rejected";
  reviewComments: string;
  approvedBy: string;
  publishedAt: string;
  auditLog: string[];
}

// ---------------------------------------------------------------------------
// Audit logger — subscribes to engine events, writes to data.auditLog
// ---------------------------------------------------------------------------

function attachAuditLogger(engine: PathEngine): () => void {
  return engine.subscribe((event: PathEvent) => {
    const ts = new Date().toISOString();
    if (event.type === "stateChanged") {
      const s = event.snapshot;
      console.log(`  [${s.pathId}] ${s.stepId}`);
    }
    if (event.type === "completed") {
      console.log(`  ✔ ${event.pathId} completed — final data:`, event.data);
    }
    if (event.type === "cancelled") {
      console.log(`  ✘ ${event.pathId} cancelled`);
    }
    if (event.type === "resumed") {
      console.log(`  ↩ resumed ${event.resumedPathId} from sub-path ${event.fromSubPathId}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Review sub-path — a multi-step review process
// ---------------------------------------------------------------------------

const reviewSubPath: PathDefinition = {
  id: "review-process",
  steps: [
    {
      id: "assign-reviewer",
      onEnter: () => ({ assignedReviewer: "alice" }),
    },
    {
      id: "collect-feedback",
      // Simulate the reviewer making a decision.
      // In real use, an external system or user action would call setData.
      // Here we leave the outcome as-is — the caller pre-sets it.
    },
    {
      id: "record-decision",
      onEnter: (ctx) => ({
        decisionRecorded: true,
        decisionTimestamp: new Date().toISOString(),
      }),
    },
  ],
};

// ---------------------------------------------------------------------------
// Main lifecycle path
// ---------------------------------------------------------------------------

function createDocLifecycle(reviewDecision: "approved" | "rejected"): PathDefinition<DocData> {
  return {
    id: "doc-lifecycle",
    steps: [
      // ---- Draft ----
      {
        id: "draft",
        meta: { allowedRoles: ["author"] },
        canMoveNext: (ctx) => {
          // Business rule: title and body are required to leave Draft
          return ctx.data.title.length > 0 && ctx.data.body.length > 0;
        },
        onLeave: (ctx) => ({
          auditLog: [...ctx.data.auditLog, `Draft submitted: "${ctx.data.title}"`],
        }),
      },

      // ---- Review (skipped for memos) ----
      {
        id: "review",
        meta: { allowedRoles: ["reviewer"], slaHours: 48 },
        shouldSkip: (ctx) => ctx.data.docType === "memo",
        onEnter: (ctx) => ({
          reviewOutcome: "pending",
          auditLog: [...ctx.data.auditLog, "Entered review"],
        }),
        onSubPathComplete: (subPathId, subData, ctx) => {
          if (subPathId !== "review-process") return;
          return {
            reviewOutcome: reviewDecision,
            reviewComments: String(subData.assignedReviewer ?? "") + " reviewed",
            auditLog: [
              ...ctx.data.auditLog,
              `Review sub-path complete — outcome: ${reviewDecision}`,
            ],
          };
        },
        canMoveNext: (ctx) => {
          // Can only advance if the review sub-path has been completed
          return ctx.data.reviewOutcome !== "pending";
        },
      },

      // ---- Approved ----
      {
        id: "approved",
        meta: { allowedRoles: ["approver"] },
        onEnter: (ctx) => {
          // If the reviewer rejected, jump back to draft
          if (ctx.data.reviewOutcome === "rejected") {
            return {
              auditLog: [
                ...ctx.data.auditLog,
                "Rejected — returning to draft for revision",
              ],
            };
          }
          return {
            approvedBy: "manager-bob",
            auditLog: [...ctx.data.auditLog, "Approved by manager-bob"],
          };
        },
        canMoveNext: (ctx) => ctx.data.reviewOutcome !== "rejected",
      },

      // ---- Published ----
      {
        id: "published",
        meta: { allowedRoles: ["publisher"] },
        onEnter: (ctx) => ({
          publishedAt: new Date().toISOString(),
          auditLog: [...ctx.data.auditLog, `Published at ${new Date().toISOString()}`],
        }),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Scenario runners
// ---------------------------------------------------------------------------

function freshData(overrides: Partial<DocData> = {}): DocData {
  return {
    title: "",
    body: "",
    docType: "standard",
    reviewOutcome: "pending",
    reviewComments: "",
    approvedBy: "",
    publishedAt: "",
    auditLog: [],
    ...overrides,
  };
}

async function scenario1_happyPath() {
  console.log("\n═══ Scenario 1: Happy path (Draft → Review → Approved → Published) ═══\n");

  const engine = new PathEngine();
  const unsub = attachAuditLogger(engine);

  await engine.start(
    createDocLifecycle("approved"),
    freshData({ title: "Q3 Report", body: "Revenue up 15% …" }),
  );

  // Draft → Review
  await engine.next();

  // Launch the review sub-path
  await engine.startSubPath(reviewSubPath, { reviewOutcome: "approved" });
  await engine.next(); // assign-reviewer → collect-feedback
  await engine.next(); // collect-feedback → record-decision
  await engine.next(); // record-decision → sub-path completes, resumes review

  // Review → Approved
  await engine.next();
  // Approved → Published
  await engine.next();
  // Published → path completes
  await engine.next();

  unsub();
}

async function scenario2_rejection() {
  console.log("\n═══ Scenario 2: Rejection (Draft → Review → reject → Draft → Review → Published) ═══\n");

  // Use a single lifecycle definition whose review step accepts both outcomes.
  // The decision is driven purely by data — not by swapping definitions.
  const lifecycle: PathDefinition<DocData> = {
    id: "doc-lifecycle",
    steps: [
      {
        id: "draft",
        meta: { allowedRoles: ["author"] },
        canMoveNext: (ctx) => ctx.data.title.length > 0 && ctx.data.body.length > 0,
        onLeave: (ctx) => ({
          auditLog: [...ctx.data.auditLog, `Draft submitted: "${ctx.data.title}"`],
        }),
      },
      {
        id: "review",
        meta: { allowedRoles: ["reviewer"] },
        onEnter: (ctx) => ({
          reviewOutcome: "pending" as const,
          auditLog: [...ctx.data.auditLog, "Entered review"],
        }),
        onSubPathComplete: (subPathId, subData, ctx) => {
          if (subPathId !== "review-process") return;
          // The sub-path's data carries the reviewer's decision
          const outcome = subData.decision as "approved" | "rejected";
          return {
            reviewOutcome: outcome,
            reviewComments: `${subData.assignedReviewer} reviewed — ${outcome}`,
            auditLog: [...ctx.data.auditLog, `Review complete — outcome: ${outcome}`],
          };
        },
        canMoveNext: (ctx) => ctx.data.reviewOutcome === "approved",
      },
      {
        id: "approved",
        meta: { allowedRoles: ["approver"] },
        onEnter: (ctx) => ({
          approvedBy: "manager-bob",
          auditLog: [...ctx.data.auditLog, "Approved by manager-bob"],
        }),
      },
      {
        id: "published",
        meta: { allowedRoles: ["publisher"] },
        onEnter: (ctx) => ({
          publishedAt: new Date().toISOString(),
          auditLog: [...ctx.data.auditLog, `Published at ${new Date().toISOString()}`],
        }),
      },
    ],
  };

  const engine = new PathEngine();
  const unsub = attachAuditLogger(engine);

  await engine.start(
    lifecycle,
    freshData({ title: "Policy Draft", body: "New travel policy …" }),
  );

  // Draft → Review
  await engine.next();

  // First review — reviewer rejects
  await engine.startSubPath(reviewSubPath, { decision: "rejected" });
  await engine.next(); // assign → collect
  await engine.next(); // collect → record
  await engine.next(); // record → sub-path completes, resumes review

  // canMoveNext blocks (outcome is "rejected"). Use goToStep to send it back.
  // This models a "reject" action — document returns to Draft for revision.
  await engine.next(); // blocked by guard — stays on review
  await engine.goToStep("draft");

  // Author revises the document
  await engine.setData("body", "Revised travel policy v2 …");

  // Draft → Review (second attempt)
  await engine.next();

  // Second review — this time approved
  await engine.startSubPath(reviewSubPath, { decision: "approved" });
  await engine.next(); // assign → collect
  await engine.next(); // collect → record
  await engine.next(); // record → sub-path completes

  // Review → Approved → Published → complete
  await engine.next();
  await engine.next();
  await engine.next();

  unsub();
}

async function scenario3_autoSkip() {
  console.log("\n═══ Scenario 3: Auto-skip (internal memo skips Review) ═══\n");

  const engine = new PathEngine();
  const unsub = attachAuditLogger(engine);

  await engine.start(
    createDocLifecycle("approved"),
    freshData({
      title: "Team Lunch Friday",
      body: "Pizza in the break room at noon.",
      docType: "memo",
    }),
  );

  // Draft → (Review is skipped) → Approved
  await engine.next();
  // Approved → Published
  await engine.next();
  // Published → complete
  await engine.next();

  unsub();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Pathwrite — Document Lifecycle Demo (no UI)\n");
  console.log("This demo uses @pathwrite/core as a backend state machine.");
  console.log("Each step is a lifecycle state; guards enforce business rules.");

  await scenario1_happyPath();
  await scenario2_rejection();
  await scenario3_autoSkip();

  console.log("\n✅ All scenarios complete.\n");
}

main();


