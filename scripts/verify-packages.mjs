#!/usr/bin/env node
/**
 * Consumer-level verification of the published artifacts.
 *
 * Every other check in this repo runs against `src`: vitest aliases all eight
 * package names to source, tsconfig.tests.json excludes `**\/dist`, and the demos
 * resolve through the workspace. That is fast and correct for unit testing, but
 * it means nothing exercises the thing users actually install. Two defects
 * shipped for months behind a fully green suite because of it:
 *
 *   - @daltonr/pathwrite-solid was built with tsc, which cannot compile Solid.
 *     Every published version threw on import.
 *   - @daltonr/pathwrite-store re-exported "./local-store" with no file
 *     extension, so Node and webpack refused to load it.
 *
 * This script packs each package, installs the tarballs into a throwaway
 * project, and imports them the way a consumer does. It is deliberately slow
 * and deliberately outside the workspace: resolution must not be able to fall
 * back to the monorepo.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * `needsRuntime` packages cannot be imported by bare Node: their framework
 * throws or their entry is not JavaScript. They are still resolution-checked,
 * which is where the real packaging bugs live.
 */
const PACKAGES = [
  { dir: "core", name: "@daltonr/pathwrite-core", import: true },
  { dir: "store", name: "@daltonr/pathwrite-store", import: true },
  { dir: "react-adapter", name: "@daltonr/pathwrite-react", import: true },
  { dir: "vue-adapter", name: "@daltonr/pathwrite-vue", import: true },
  { dir: "solid-adapter", name: "@daltonr/pathwrite-solid", import: true },
  { dir: "react-native-adapter", name: "@daltonr/pathwrite-react-native", import: false },
  { dir: "svelte-adapter", name: "@daltonr/pathwrite-svelte", import: false },
  { dir: "angular-adapter", name: "@daltonr/pathwrite-angular", import: false },
];

// Files an export condition points at must exist in the tarball, and these must
// always ship.
const REQUIRED = ["README.md", "LICENSE"];

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const results = [];
const fail = (pkg, msg) => results.push({ pkg, ok: false, msg });
const pass = (pkg, msg) => results.push({ pkg, ok: true, msg });

const work = mkdtempSync(join(tmpdir(), "pathwrite-verify-"));
console.log(`verifying published artifacts in ${work}\n`);

try {
  writeFileSync(
    join(work, "package.json"),
    JSON.stringify({ name: "verify", private: true, type: "module" }, null, 2)
  );

  // 1. Pack. npm pack runs prepublishOnly, so this is the real publish output.
  const tarballs = [];
  for (const p of PACKAGES) {
    const out = run("npm", ["pack", join(repoRoot, "packages", p.dir), "--pack-destination", work], work);
    const file = out.trim().split("\n").pop().trim();
    tarballs.push(file);
    p.tarball = join(work, file);

    const listing = run("tar", ["tzf", p.tarball], work)
      .split("\n")
      .map((l) => l.replace(/^package\//, "").trim())
      .filter(Boolean);

    for (const required of REQUIRED) {
      if (!listing.includes(required)) fail(p.name, `tarball is missing ${required}`);
    }

    // Every path an export condition names must actually be in the tarball.
    const manifest = JSON.parse(run("tar", ["xzOf", p.tarball, "package/package.json"], work));
    const targets = new Set();
    const walk = (node) => {
      if (typeof node === "string") targets.add(node);
      else if (node && typeof node === "object") Object.values(node).forEach(walk);
    };
    walk(manifest.exports ?? {});
    for (const t of targets) {
      const rel = t.replace(/^\.\//, "");
      if (!listing.includes(rel)) fail(p.name, `exports points at ${t}, not in tarball`);
    }
  }

  // 2. Install every tarball together, so internal dependency ranges resolve
  //    against each other exactly as they will for a consumer.
  run("npm", ["install", "--no-audit", "--no-fund", ...tarballs.map((t) => `./${t}`)], work);
  run("npm", ["install", "--no-audit", "--no-fund", "--no-save", "solid-js", "react", "vue"], work);

  // 3. Import each package as a consumer. Resolution failures are packaging
  //    bugs; a framework refusing to boot under bare Node is not.
  mkdirSync(join(work, "probe"), { recursive: true });
  for (const p of PACKAGES) {
    const probe = join(work, "probe", `${p.dir}.mjs`);
    writeFileSync(
      probe,
      p.import
        ? `import * as m from ${JSON.stringify(p.name)};
           if (!Object.keys(m).length) { console.error("NO_EXPORTS"); process.exit(1); }
           console.log("OK");`
        : // Resolution only: proves the export map and entry file exist.
          `import { createRequire } from "node:module";
           const r = createRequire(${JSON.stringify(join(work, "probe/x.js"))});
           const { pathToFileURL } = await import("node:url");
           const s = await import.meta.resolve(${JSON.stringify(p.name)});
           if (!s) { console.error("UNRESOLVED"); process.exit(1); }
           console.log("OK");`
    );
    try {
      run("node", [probe], work);
      pass(p.name, p.import ? "imports" : "resolves");
    } catch (e) {
      const err = `${e.stdout ?? ""}${e.stderr ?? ""}`.split("\n").find((l) => l.trim()) ?? "failed";
      fail(p.name, (p.import ? "import failed: " : "resolve failed: ") + err.trim().slice(0, 140));
    }
  }
} finally {
  if (!process.env.PATHWRITE_KEEP_VERIFY_DIR) rmSync(work, { recursive: true, force: true });
}

const failures = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "  ok  " : "FAIL  "}${r.pkg.padEnd(32)} ${r.msg}`);
console.log();
if (failures.length) {
  console.error(`${failures.length} packaging failure(s). These are what consumers hit on install.`);
  process.exit(1);
}
console.log(`all ${PACKAGES.length} packages install and load as a consumer.`);
