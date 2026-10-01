# Development Guide

## Project layout

- `backend/node` — production Node.js / Express gateway, miner endpoints, Telegraph integration, and dashboard assets.
- `backend/python` — FastAPI risk-analysis engine and SQLite persistence helpers.
- `frontend` — standalone frontend package used by the repository's frontend workflow.
- `src` — root application/dashboard source retained for the root build.
- `wasm` — deterministic scorer source, validation tooling, and protocol artifact workflow.
- `docs` — operational, architecture, integration, and scorer documentation.
- `fixtures` — deterministic local test data.

## Runtime versions

The production Docker image and CI use **Node.js 20**. Python development uses **Python 3.12** in CI. Match those versions when reproducing production behavior locally.

## Node gateway

```bash
cd backend/node
npm install
npm run build
npm start
```

The gateway normally listens on `http://localhost:4000`.

For development with automatic TypeScript reloads:

```bash
npm run dev
```

## Python risk engine

```bash
cd backend/python
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The Python service is intended to support the Node gateway rather than serve the public dashboard directly.

## Testing

The CI workflow runs the Node build, provider-focused TVL and web-search suites, and the Python risk-engine test suite.

Run the Node provider suites locally with:

```bash
cd backend/node
npm run build
npm run test:tvl
npm run test:web-search
```

The gateway/integration suites in `backend/node/tests/` expect a gateway to be running on `http://127.0.0.1:4000`:

```bash
npm start
# in another terminal:
node --import tsx tests/gateway.test.ts
node --import tsx tests/miner.test.ts
node --import tsx tests/track1.test.ts
```

Run the Python suite with:

```bash
cd backend/python
python tests/run_tests.py
```

## WASM validation

From the repository root:

```bash
node wasm/validate_scorer.js
```

The validator checks the local scorer artifact and deterministic ranking behavior. It does not reproduce Telegraph's hidden benchmark.

## Configuration

Copy `.env.example` to a local environment file and provide only the credentials required for the services you are running. Never commit real credentials, wallet keys, API tokens, or production environment files.

## Scoring-sensitive changes

The registered intents are:

- `CRYPTO_PRICE`
- `TVL_LOOKUP`
- `WEB_SEARCH`

When investigating scoring changes, isolate one variable at a time, compare multiple epochs, and preserve the existing protocol artifacts unless there is evidence that they need to change.
