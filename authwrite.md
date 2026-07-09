# Authwrite — authorization for TypeScript that explains itself

> Authwrite (AuthEngine) is a zero-dependency TypeScript authorization library. Policies are plain TypeScript objects — no DSL, no config files, no sidecar — evaluated anywhere (Node, edge, browser). Every decision returns the rule that matched, why, and how long evaluation took. Observers handle audit logging, caching, and metrics without touching policy logic; an enforcer wrapper supports audit / enforce / suspended / lockdown modes for gradual adoption and incident response.

- npm: `@daltonr/authwrite-core` (engine + types), `@daltonr/authwrite-testing` (test helpers)
- Repo: https://github.com/richardadalton/authwrite
- License: MIT.

## Quick start

```ts
import { createAuthEngine } from '@daltonr/authwrite-core'

const engine = createAuthEngine({
  policy: {
    id: 'documents',
    version: '1.0.0',
    defaultEffect: 'deny',            // safe starting point
    rules: [
      {
        id: 'owner-full-access',
        match: ({ subject, resource }) =>
          resource?.id !== undefined && resource.ownerId === subject.id,
        allow: ['*'],
      },
      {
        id: 'archived-blocks-mutation',
        priority: 10,                  // higher number wins; deny beats allow at equal priority
        match: ({ resource }) => resource?.attributes?.status === 'archived',
        deny: ['write', 'delete'],
      },
    ],
  },
})

const decision = await engine.evaluate({
  subject:  { id: 'u1', roles: ['editor'] },
  resource: { type: 'document', id: 'doc-1', ownerId: 'u1' },
  action:   'delete',
})

decision.allowed     // boolean
decision.reason      // 'owner-full-access' | 'archived-blocks-mutation' | 'default' | ...
decision.rule        // the full rule object that decided
decision.durationMs  // evaluation time
```

## Core concepts

- **Policies are plain TypeScript** — `PolicyDefinition<Subject, Resource>` is a typed object; rules are functions (`match` selects when a rule applies, optional `condition` adds a further check, `allow`/`deny` list actions, `'*'` = all).
- **Every decision carries a reason** — `evaluate()` always returns a `Decision` naming the rule that determined the outcome. No silent denials.
- **Three action categories** — instance actions (`resource` with `id`), type actions (`resource` without `id`, e.g. `create`), and subject actions (no `resource` at all, e.g. `change-password`).
- **Priority resolves conflicts** — higher `priority` number wins; deny beats allow at equal priority; `defaultEffect` applies when nothing matches.
- **Observers handle side effects** — `observers: [{ async onDecision({ decision }) { ... } }]` receive every decision after evaluation: audit logs, metrics, caching.
- **Field-level filtering** — policies may add `fieldRules` with `expose`/`redact` lists; `engine.evaluateRead({ subject, resource })` returns `{ decision, allowedFields }` for building safe read responses.

## Gradual adoption: enforcer modes

```ts
const enforcer = createEnforcer(engine, { mode: 'audit' })   // Phase 1: log would-be denials, never block
const enforcer = createEnforcer(engine, { mode: 'enforce' }) // Phase 2: enforce
enforcer.setMode('suspended')  // incident response: block everything, keep audit trail
enforcer.setMode('lockdown')   // most severe: bypass engine entirely, no observers
```

## Testing

```ts
import { decisionRecorder, coverageReport } from '@daltonr/authwrite-testing'

const recorder = decisionRecorder()
const engine = createAuthEngine({ policy, observers: [recorder] })
// ... run your test suite ...
const report = coverageReport(engine, recorder.all())
report.untouchedRules   // rules that never fired — add a test!
report.coveragePercent  // e.g. 87.5
```

## Package map

| Package | Description | Status |
|---|---|---|
| `@daltonr/authwrite-core` | Zero-dependency engine, all types | released |
| `@daltonr/authwrite-testing` | `decisionRecorder`, `coverageReport` | released |
| `@daltonr/authwrite-express` / `-fastify` / `-nextjs` / `-hono` | Framework middleware/adapters | in progress |
| `@daltonr/authwrite-observer-pg` / `-observer-redis` / `-observer-otel` | Audit log / cache / telemetry observers | in progress |
| `@daltonr/authwrite-loader-db` / `-loader-yaml` | Policy loaders | in progress |

See the repo README for full details and current package status.
