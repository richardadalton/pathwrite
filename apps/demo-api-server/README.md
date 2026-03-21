# Demo API Server for Pathwrite store-http

Simple Express server that stores wizard state in memory.

## Installation

```bash
npm install
```

## Usage

Start the server:

```bash
npm start
```

Server runs on http://localhost:3001

## Endpoints

- **POST** `/api/wizard/state/:key` - Save wizard state
- **GET** `/api/wizard/state/:key` - Load wizard state
- **DELETE** `/api/wizard/state/:key` - Clear wizard state
- **GET** `/health` - Health check

## Example

```bash
# Save state
curl -X POST http://localhost:3001/api/wizard/state/user:123:onboarding \
  -H "Content-Type: application/json" \
  -d '{"step": 1, "data": {"name": "Alice"}}'

# Load state
curl http://localhost:3001/api/wizard/state/user:123:onboarding
```

## Features

- In-memory storage (resets when server restarts)
- CORS enabled for local development
- Console logging of all POST/GET requests
- Returns 404 if state not found

