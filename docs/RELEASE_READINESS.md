# Pathwrite 1.0.0 Release Readiness Assessment

**Date:** March 22, 2026

---

## Overall: ~85% Ready

The core engine and most adapters are production-quality. A handful of gaps remain — mostly around the Svelte adapter (no tests) and one Angular shell issue.

---

## ✅ What's Ready

### Core Engine (`@daltonr/pathwrite-core`)
- **978 lines of source**, 209 tests — mature and well-tested
- Full feature set: guards, hooks, sub-paths, skipping, serialization/restoration
- Async guard support with sync snapshot fallback
- Guard error resilience with helpful warnings
- `exportState()` / `fromState()` round-trip serialization
- Zero framework dependencies, zero TODOs in source
- **Verdict: 1.0 ready**

### React Adapter (`@daltonr/pathwrite-react`)
- 448 lines of source, 70 tests (usePath + PathShell)
- `usePath()` hook with external engine support
- `PathShell` component with steps prop and slot overrides
- **Verdict: 1.0 ready**

### Vue Adapter (`@daltonr/pathwrite-vue`)
- 351 lines of source, 61 tests (usePath + PathShell)
- `usePath()` composable with external engine support
- `PathShell` component with named slots
- **Verdict: 1.0 ready**

### Angular Adapter (`@daltonr/pathwrite-angular`)
- 508 lines of source (index.ts + shell.ts), 61 tests
- `PathFacade` service with `adoptEngine()` for external engines
- `<pw-shell>` component with ng-template directives
- **Verdict: 1.0 ready (with one caveat — see below)**

### Store HTTP (`@daltonr/pathwrite-store-http`)
- 381 lines of source, 37 tests
- `HttpStore`, `httpPersistence()` observer, `restoreOrStart()` convenience
- Strategy support: `onNext`, `onEveryChange`, `onComplete`
- Debounce, error callbacks, full serialization
- **Verdict: 1.0 ready**

### Documentation
- Developer Guide, Persistence Strategy Guide, Beyond Wizards, Competitive Analysis
- Per-package READMEs (all updated for current APIs)
- Publishing guide with changeset workflow
- **Verdict: 1.0 ready**

### Test Suite
- 489 tests, all passing, across 8 test files
- Core: 209 | Angular: 61 | React: 70 | Vue: 61 | Svelte: 51 | Store-HTTP: 37
- **Verdict: Solid coverage for core and all 5 adapters**

### Demo Apps
- 7 demo apps covering console, Angular (3), Vue, Svelte, lifecycle
- API server for persistence demos
- **Verdict: Good showcase**

---

## 🟡 Gaps to Close Before 1.0

### 1. Svelte Adapter Has Zero Tests
**Priority: High**

Every other adapter has 60+ tests. The Svelte adapter has an empty `test/` directory. This is the biggest gap. At minimum it needs:
- `usePath()` tests (comparable to React/Vue — ~35 tests)
- `PathShell` tests with snippet rendering (~25 tests)
- `getPathContext()` / `setPathContext()` tests
- `bindData()` tests

**Effort:** 1–2 days

### 2. Angular `<pw-shell>` Missing `[engine]` Input
**Priority: Medium** (from storage-feedback.md, item #14 — still open)

React, Vue, and Svelte PathShell components all accept an `engine` prop for externally-managed engines (persistence). Angular's `<pw-shell>` does not — users must use `@ViewChild` + `adoptEngine()`, which is undocumented and awkward.

**Effort:** Half a day

### 3. Convenience Wrapper for Persisted Engine Setup
**Priority: Medium** (from svelte-developer-feedback.md — still open)

The `restoreOrStart` + `httpPersistence` + `HttpStore` pattern is verbose for the 90% case. A single-call convenience function in `store-http` would reduce boilerplate across all frameworks. Not a blocker, but a DX improvement worth shipping at 1.0.

**Effort:** Half a day

### 4. Publishing Guide Missing Svelte + Store-HTTP
**Priority: Low**

`PUBLISHING.md` lists 4 packages (core, angular, react, vue). It needs to add `@daltonr/pathwrite-svelte` and `@daltonr/pathwrite-store-http`.

**Effort:** 10 minutes

### 5. `usePath()` in Svelte Adapter Still Uses Svelte 4 Store API
**Priority: Low**

`PathShell.svelte` was migrated to Svelte 5 runes, but `usePath()` in `index.ts` still uses `writable()`, `derived()`, `onDestroy()` from `svelte/store`. These work under Svelte 5's compatibility layer, so it's not broken — but for a clean 1.0 it should use `$state`/`$derived` runes natively in a `.svelte.ts` file.

**Effort:** 1 day (requires restructuring the file to `.svelte.ts`)

---

## 🟢 Nice-to-Haves (Post 1.0)

| Item | Source |
|------|--------|
| Pass `snapshot`/`setData` as props to Svelte step components | svelte-developer-feedback.md |
| Framework-specific `usePersistedPath()` composables | storage-feedback.md (closed as non-issue, but could revisit) |
| Real-browser integration test for fetch | storage-feedback.md (closed) |

---

## 📊 Summary

| Area | Status | Blocking 1.0? |
|------|--------|----------------|
| Core engine | ✅ 209 tests, feature-complete | No |
| React adapter | ✅ 70 tests, PathShell works | No |
| Vue adapter | ✅ 61 tests, PathShell works | No |
| Angular adapter | ✅ 61 tests, shell needs `[engine]` input | **Yes** |
| Svelte adapter | ✅ 51 tests, PathShell works | No |
| Store HTTP | ✅ 37 tests, API stable | No |
| Documentation | ✅ All READMEs current | No (minor publishing doc gap) |
| Demo apps | ✅ 7 apps across 4 frameworks | No |
| TODOs in source | ✅ Zero | No |

### Minimum Path to 1.0

1. ~~**Write Svelte adapter tests**~~ ✅ Done — 51 tests
2. **Add `[engine]` input to Angular `<pw-shell>`** (~half day)
3. **Update PUBLISHING.md** (~10 min)

### Recommended (not blocking)

4. Add convenience persistence wrapper (~half day)
5. Migrate `usePath()` to Svelte 5 runes (~1 day)

**Estimated time to 1.0: 1–2 days of focused work.**




