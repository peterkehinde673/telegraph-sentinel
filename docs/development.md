# Development Guide

## Repository layout

- `backend/node` — Node.js / Express gateway, Telegraph API routes, dashboard assets, and WebSocket layer.
- `backend/python` — Python / FastAPI risk-analysis service.
- `wasm` — WASM scorer source/build and local validation tooling.
- `docs` — project documentation and integration artifacts.

## Local prerequisites

Use the runtime versions appropriate to the checked-in project environment. The previously validated development environment used Node.js/npm and Python with a virtual environment, plus SQLite.

## Running the gateway locally

```bash
cd backend/node
npm install
npm run build
npm start
```

The local gateway normally listens on `http://localhost:4000`.

## Running the Python service

From the repository root, activate the Python environment and run the FastAPI application according to the project's environment configuration. The service is intended to be consumed by the Node gateway rather than exposed directly as the public dashboard.

## WASM validation

From the repository root:

```bash
node wasm/validate_scorer.js
```

The validator checks the locally built scorer and its deterministic ranking behavior. Local validation cannot reproduce Telegraph's hidden benchmark/evaluation set.

## Testing

For the Node gateway:

```bash
cd backend/node
npm test
```

Build before deployment:

```bash
npm run build
```
