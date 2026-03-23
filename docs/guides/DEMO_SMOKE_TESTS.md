# Demo Smoke Tests

Use this guide to quickly verify that all root demo scripts start successfully.

## Command

```zsh
npm run smoke:demos
```

## What It Does

- Reads root `package.json` and finds all `demo:*` scripts
- Starts each demo one at a time
- Marks a demo as pass when startup readiness appears in logs
- Stops the demo process and moves to the next script
- Prints a summary and JSON results block at the end

## Optional Timeout

By default, each demo has a 14 second startup timeout.

```zsh
SMOKE_DEMOS_TIMEOUT_MS=25000 npm run smoke:demos
```

Use a higher value if your machine is under heavy load.

