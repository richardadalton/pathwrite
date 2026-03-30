# Publishing

This document covers the end-to-end process for versioning and publishing Pathwrite packages to npm.

---

## Prerequisites

**npm account with publish access to the `@daltonr` scope.**

```bash
npm login
npm whoami   # should print your username
```

If `whoami` fails, or if you receive a 403 during publish, your account does not have access to the scope. Contact the scope owner.

**Clean working tree.** Commit or stash everything before versioning. Changesets reads the Git state and will warn if there are uncommitted changes.

---

## What gets published

Eight packages are published under the `@daltonr` scope. They are always versioned together (fixed group).

| Package name | Workspace path |
|---|---|
| `@daltonr/pathwrite-core` | `packages/core` |
| `@daltonr/pathwrite-react` | `packages/react-adapter` |
| `@daltonr/pathwrite-react-native` | `packages/react-native-adapter` |
| `@daltonr/pathwrite-vue` | `packages/vue-adapter` |
| `@daltonr/pathwrite-angular` | `packages/angular-adapter` |
| `@daltonr/pathwrite-svelte` | `packages/svelte-adapter` |
| `@daltonr/pathwrite-solid` | `packages/solid-adapter` |
| `@daltonr/pathwrite-store` | `packages/store` |

Demo apps and shared workflow packages are in the Changesets `ignore` list and are never published.

---

## Versioning with Changesets

Pathwrite uses [Changesets](https://github.com/changesets/changesets) to manage versions and changelogs.

### Step 1 — Describe the change

After landing a meaningful change (or before committing it), create a changeset:

```bash
npm run changeset
```

The CLI will ask you to:

1. **Select packages** — because all seven packages are in a fixed group, selecting any one bumps all of them.
2. **Choose a bump type** — `patch` for bug fixes, `minor` for new features, `major` for breaking changes.
3. **Write a summary** — one sentence that will appear in each package's `CHANGELOG.md`.

This creates a Markdown file in `.changeset/` (e.g. `.changeset/brave-dogs-dance.md`). Commit it alongside your code:

```bash
git add .changeset
git commit -m "chore: add changeset"
```

You can accumulate multiple changesets before releasing. They are collapsed into a single version bump when you run `version`.

### Step 2 — Apply changesets to bump versions

When you are ready to cut a release:

```bash
npm run version
```

This consumes every `.changeset/*.md` file, bumps `version` in each package's `package.json`, updates `CHANGELOG.md` in each package, and updates internal dependency ranges between packages (e.g. the adapters' dependency on `@daltonr/pathwrite-core`).

Review the diff, then commit:

```bash
git add -A
git commit -m "chore: version packages"
```

---

## Pre-release check

Before publishing, verify that the repo builds cleanly and all tests pass:

```bash
npm run prepublish:check
```

This runs `clean → build → test` in sequence. All three must pass before you publish. The `release` script runs this automatically, but running it manually first gives you a faster feedback loop.

---

## Publishing

```bash
npm run publish:all
```

This runs `prepublish:check` and then publishes each package in the correct order. Each package's own `prepublishOnly` script also runs `clean && build` as a safeguard — so the published tarball always contains freshly built output.

Alternatively, `npm run release` does the same thing via `changeset publish`, which only publishes packages whose version is newer than what is currently on the registry.

---

## Post-publish checklist

**Push the version commit and tags:**

```bash
git push --follow-tags
```

**Verify on npmjs.com.** Check each package at:

- https://www.npmjs.com/package/@daltonr/pathwrite-core
- https://www.npmjs.com/package/@daltonr/pathwrite-react
- https://www.npmjs.com/package/@daltonr/pathwrite-react-native
- https://www.npmjs.com/package/@daltonr/pathwrite-vue
- https://www.npmjs.com/package/@daltonr/pathwrite-angular
- https://www.npmjs.com/package/@daltonr/pathwrite-svelte
- https://www.npmjs.com/package/@daltonr/pathwrite-solid
- https://www.npmjs.com/package/@daltonr/pathwrite-store

Confirm the new version number appears and the `dist/` files are present in the file explorer.

**Update demo apps.** Demo apps under `apps/` install published packages from npm independently. After a release, reinstall each one so they get the new version with built assets:

```bash
cd apps/angular-demos/demo-angular-form && npm install && cd -
cd apps/react-demos/demo-react-form && npm install && cd -
cd apps/vue-demos/demo-vue-form && npm install && cd -
cd apps/svelte-demos/demo-svelte-form && npm install && cd -
```

This matters for Angular in particular — `angular.json` resolves CSS assets relative to the project's own `node_modules/`, so a stale install will fail to find the new shell stylesheet.

---

## Dry run

To see exactly what would be published without uploading anything:

```bash
npm run publish:dry
```

This runs `prepublish:check` and then `npm publish --dry-run` for each package, printing the tarball contents and metadata.

---

## Hotfix to a single package

If you need to patch only one package (rare — the fixed group normally requires all to move together):

```bash
cd packages/core
npm run prepublishOnly   # clean + build
npm publish
```

Remember to keep version numbers in sync across the group if you do this.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm ERR! 403` | Not logged in or no access to `@daltonr`. Run `npm login`. |
| `npm ERR! 402` | Scoped package not configured for public access. All packages already set `"access": "public"` in `publishConfig` — this should not occur. |
| Tests fail during publish | Fix the failing tests first. Do not skip `prepublish:check`. |
| Version already exists | You published this version before. Create a new changeset and run `npm run version` again. |
| Changesets not detected | Make sure `.changeset/*.md` files exist and are committed. Run `npm run changeset` to create one. |

---

© 2026 Devjoy Ltd. MIT License.
