# Publishing Guide

This document describes how to version and publish the Pathwrite packages to npm.

## Packages

All four public packages are published under the `@daltonr` scope:

| Package | npm |
|---------|-----|
| `@daltonr/pathwrite-core` | [npmjs.com/package/@daltonr/pathwrite-core](https://www.npmjs.com/package/@daltonr/pathwrite-core) |
| `@daltonr/pathwrite-angular` | [npmjs.com/package/@daltonr/pathwrite-angular](https://www.npmjs.com/package/@daltonr/pathwrite-angular) |
| `@daltonr/pathwrite-react` | [npmjs.com/package/@daltonr/pathwrite-react](https://www.npmjs.com/package/@daltonr/pathwrite-react) |
| `@daltonr/pathwrite-vue` | [npmjs.com/package/@daltonr/pathwrite-vue](https://www.npmjs.com/package/@daltonr/pathwrite-vue) |

Demo/app packages are **never** published (they are listed in the changeset `ignore` config).

## Prerequisites

1. **npm account** — you must be logged in to an npm account that has publish access to the `@daltonr` scope.

   ```bash
   npm login
   npm whoami          # should print your username
   ```

2. **Node & npm** — use the same Node version the repo targets (any current LTS).

3. **Clean working tree** — commit or stash all changes before versioning.

## Versioning with Changesets

Pathwrite uses [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs. All four packages are in a **fixed** version group, meaning they always share the same version number.

### 1. Add a changeset

After landing a PR (or before committing a change), describe what changed:

```bash
npm run changeset
```

The CLI will prompt you to:

1. **Select packages** — pick the packages affected by your change. Because the packages are in a fixed group, selecting any one will bump all four.
2. **Choose a bump type** — `patch`, `minor`, or `major`.
3. **Write a summary** — a short description that will appear in each package's `CHANGELOG.md`.

This creates a Markdown file in `.changeset/` (e.g. `.changeset/brave-dogs-dance.md`). Commit it alongside your code.

> **Tip:** You can add multiple changesets before releasing. They will be collapsed into a single version bump at release time.

### 2. Version the packages

When you're ready to cut a release, apply all pending changesets:

```bash
npm run version
```

This will:

- Consume every `.changeset/*.md` file.
- Bump `version` in each package's `package.json`.
- Update (or create) `CHANGELOG.md` in each package.
- Update internal dependency ranges (e.g. the adapters' dependency on `@daltonr/pathwrite-core`).

Review the resulting diff, then commit:

```bash
git add -A
git commit -m "chore: version packages"
```

### 3. Publish to npm

```bash
npm run release
```

This runs the full pre-publish pipeline (`clean → build → test`) and then calls `changeset publish`, which publishes every package whose version is newer than what's on the registry.

Each package's `prepublishOnly` script also runs `clean && build` as an extra safeguard.

After publishing, push the version commit and tag(s):

```bash
git push --follow-tags
```

## Dry Run

To verify what _would_ be published without actually uploading anything:

```bash
npm run publish:dry
```

This runs the pre-publish checks and then executes `npm publish --dry-run` for each package, showing the tarball contents and metadata.

## Manual / Individual Publish

If you ever need to publish a single package (e.g. a hotfix to core only):

```bash
cd packages/core
npm run prepublishOnly    # clean + build
npm publish
```

Repeat for any other packages that need updating. Remember to keep versions in sync across the fixed group.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `npm ERR! 403` | You're not logged in or don't have publish access to `@daltonr`. Run `npm login`. |
| `npm ERR! 402` | The package is scoped but not configured for public access. All packages already set `"access": "public"` in `publishConfig`. |
| Tests fail during `release` | The `prepublish:check` script runs `clean`, `build`, and `test` before publishing. Fix the failing tests first. |
| Version already exists on registry | You may have published this version before. Bump again with a new changeset. |
| Changesets not detected | Make sure `.changeset/*.md` files exist and are committed. Run `npm run changeset` to create one. |

## Summary Cheat Sheet

```bash
# 1. Describe your change
npm run changeset

# 2. Commit the changeset file
git add .changeset && git commit -m "chore: add changeset"

# 3. When ready to release — bump versions
npm run version

# 4. Commit version bumps
git add -A && git commit -m "chore: version packages"

# 5. Publish
npm run release

# 6. Push commit + tags
git push --follow-tags
```
