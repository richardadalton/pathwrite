import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_TIMEOUT_MS = 14000;
const INTER_RUN_DELAY_MS = 250;

const stripAnsi = (text) => text.replace(/\u001b\[[0-9;]*m/g, '');
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const isReady = (output) =>
  /Compiled successfully\.|Angular Live Development Server is listening|VITE v\d|ready in \d+ ms|Local:\s+http:\/\//i.test(output);

const isFailure = (output) =>
  /Failed to compile|Error: Unknown argument|ERR_MODULE_NOT_FOUND|could not resolve/i.test(output);

async function getDemoScripts(rootDir) {
  const packageJsonPath = resolve(rootDir, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const allScripts = Object.keys(packageJson.scripts ?? {});
  return allScripts
    .filter((name) => name.startsWith('demo:'))
    .sort((a, b) => a.localeCompare(b));
}

function runScript(rootDir, script, timeoutMs) {
  return new Promise((resolveRun) => {
    const child = spawn('npm', ['run', script], {
      cwd: rootDir,
      env: { ...process.env, CI: '1' },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    let clean = '';
    let url = '-';
    let finished = false;

    const finish = (status, note) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {}
      setTimeout(() => {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {}
      }, 600);

      const tail = clean.split(/\r?\n/).filter(Boolean).slice(-5).join(' | ');
      resolveRun({ script, status, url, note, tail });
    };

    const onData = (buffer) => {
      output += String(buffer);
      clean = stripAnsi(output);
      const match = clean.match(/https?:\/\/[\w.-]+:\d+\/?/);
      if (match) {
        url = match[0];
      }

      if (!finished && isReady(clean)) {
        finish('PASS', 'ready');
      }
      if (!finished && isFailure(clean)) {
        finish('FAIL', 'startup error');
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    const timer = setTimeout(() => finish('FAIL', 'timeout'), timeoutMs);
    child.on('exit', (code) => {
      if (!finished) {
        finish(code === 0 ? 'PASS' : 'FAIL', `exited ${code}`);
      }
    });
  });
}

async function main() {
  const currentFile = fileURLToPath(import.meta.url);
  const rootDir = resolve(dirname(currentFile), '..');
  const timeoutMs = Number(process.env.SMOKE_DEMOS_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

  const scripts = await getDemoScripts(rootDir);
  if (scripts.length === 0) {
    console.error('No demo scripts found in package.json.');
    process.exitCode = 1;
    return;
  }

  const results = [];
  for (const script of scripts) {
    // eslint-disable-next-line no-await-in-loop
    const result = await runScript(rootDir, script, timeoutMs);
    results.push(result);
    console.log(`${result.status} ${result.script} ${result.url} ${result.note}`);
    // eslint-disable-next-line no-await-in-loop
    await sleep(INTER_RUN_DELAY_MS);
  }

  const passed = results.filter((result) => result.status === 'PASS').length;
  console.log(`Passed ${passed}/${results.length}`);
  console.log('RESULTS_JSON_START');
  console.log(JSON.stringify(results, null, 2));
  console.log('RESULTS_JSON_END');

  if (passed !== results.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

