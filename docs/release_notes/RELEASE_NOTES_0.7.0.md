# Release 0.7.0 - LocalStorageStore Support

**Release Date:** March 24, 2026

## Summary

This release adds **LocalStorageStore** to `@daltonr/pathwrite-store-http`, providing browser-local persistence for wizard state. This complements the existing `HttpStore` (REST API persistence), giving developers a choice between local and server-backed storage.

## New Features

### LocalStorageStore

- **Browser-local persistence** using `localStorage` (or in-memory fallback)
- **Automatic key namespacing** with configurable prefix (default: `@daltonr/pathwrite:`)
- **URL-safe key encoding** for special characters
- **Session management** with `list()` and `clear()` methods
- **Pluggable storage adapter** interface (supports `sessionStorage` or custom backends)
- **In-memory fallback** when `localStorage` is unavailable (SSR, Node, tests)
- **Full integration** with `httpPersistence` and `restoreOrStart`

### Demo: demo-vue-storage

Enhanced the Vue storage demo to showcase:
- **Runtime storage switching** between localStorage and API server
- **Session picker** using `LocalStorageStore.list()`
- **Multi-session management** with independent save/restore
- **Error handling** when API server is unavailable

## Package Updates

All packages bumped to version **0.7.0**:

- `@daltonr/pathwrite-core@0.7.0` - No changes, coordinated release
- `@daltonr/pathwrite-store-http@0.7.0` - **LocalStorageStore** added
- `@daltonr/pathwrite-angular@0.7.0` - Dependency update only
- `@daltonr/pathwrite-react@0.7.0` - Dependency update only
- `@daltonr/pathwrite-vue@0.7.0` - Dependency update only
- `@daltonr/pathwrite-svelte@0.7.0` - Dependency update only

## Test Coverage

- **36 new tests** for LocalStorageStore
- **Total: 536 tests** across 9 test suites
- **100% passing**

### LocalStorageStore Test Coverage

- Core operations (save, load, delete)
- Key encoding and prefix isolation
- Storage adapter injection (localStorage, sessionStorage, custom)
- Error propagation (QuotaExceededError, invalid JSON, etc.)
- Session management (list, clear)
- Integration with httpPersistence and restoreOrStart
- Full round-trip persistence workflows

## Documentation Updates

### Updated Files

1. **packages/store-http/README.md**
   - Added LocalStorageStore as primary feature (alongside HttpStore)
   - Storage adapter comparison table
   - Quick start examples for both adapters
   - Session management examples (list/clear)
   - Updated all code examples to work with both stores

2. **packages/store-http/CHANGELOG.md**
   - Added 0.7.0 release notes with comprehensive feature list

3. **README.md** (root)
   - Updated test count: 492 → 536 tests
   - Added LocalStorageStore to test suite breakdown
   - Enhanced HTTP Storage section with localStorage/API comparison
   - Added demo-vue-storage documentation

4. **All adapter CHANGELOGs**
   - Added 0.7.0 coordinated release notes

## Breaking Changes

**None.** This is a fully backward-compatible minor version release.

## Migration Guide

No migration required. Existing code using `HttpStore` continues to work unchanged.

### Switching from HttpStore to LocalStorageStore

```typescript
// Before (HTTP storage)
import { HttpStore } from "@daltonr/pathwrite-store-http";
const store = new HttpStore({ baseUrl: "/api/wizard" });

// After (localStorage)
import { LocalStorageStore } from "@daltonr/pathwrite-store-http";
const store = new LocalStorageStore({ prefix: "myapp:" });

// Everything else stays the same
const { engine, restored } = await restoreOrStart({
  store, // ← Same interface, different backend
  key: "user:123:session",
  path: myPath,
  observers: [httpPersistence({ store, key: "user:123:session" })],
});
```

## API Reference

### LocalStorageStore Constructor

```typescript
new LocalStorageStore({
  prefix?: string;              // Default: "@daltonr/pathwrite:"
  storage?: StorageAdapter | null;  // Default: auto-detect localStorage or fallback
})
```

### Methods

| Method | Description |
|--------|-------------|
| `save(key, state)` | Save a snapshot to storage |
| `load(key)` | Load a snapshot (returns `null` if not found) |
| `delete(key)` | Delete a snapshot |
| `list()` | Return all keys saved under this store's prefix |
| `clear()` | Delete all snapshots under this store's prefix |

### StorageAdapter Interface

```typescript
interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  getAllKeys?(): string[];  // Required for list() and clear()
}
```

## Next Steps

### Publishing

```bash
# First, verify everything is ready (runs clean, build, and test)
npm run publish:dry

# If dry-run looks good, publish all packages
npm run publish:all
```

The `publish:all` script will:
1. Clean all dist folders
2. Rebuild all packages
3. Run all tests
4. Publish all 6 packages to npm registry

You can also publish individually if needed:
```bash
cd packages/core && npm publish
cd ../store-http && npm publish
cd ../angular-adapter && npm publish
cd ../react-adapter && npm publish
cd ../vue-adapter && npm publish
cd ../svelte-adapter && npm publish
```

### Post-Release

1. Tag the release in Git: `git tag v0.7.0`
2. Push tags: `git push --tags`
3. Create GitHub release with these notes
4. Update live documentation if hosted externally

## Implementation Details

### File Changes

- **New files:**
  - `packages/store-http/src/local-store.ts` (156 lines)
  - `packages/store-http/test/local-store.test.ts` (464 lines)
  - `RELEASE_NOTES_0.7.0.md` (this file)

- **Modified files:**
  - `packages/store-http/src/index.ts` (added exports)
  - `packages/store-http/README.md` (comprehensive rewrite)
  - `packages/store-http/CHANGELOG.md` (0.7.0 notes)
  - `packages/store-http/package.json` (version bump, description update)
  - All package.json files (version bumps)
  - All CHANGELOG.md files (coordinated release notes)
  - Root README.md (test count, demo documentation)

### Lines of Code

- **LocalStorageStore implementation:** 156 lines
- **LocalStorageStore tests:** 464 lines
- **Total new code:** 620 lines
- **Test coverage:** 36 tests, 100% passing

## Contributors

- Richard Dalton

---

© 2026 Devjoy Ltd. MIT License.


