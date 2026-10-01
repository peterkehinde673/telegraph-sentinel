# Telegraph Sentinel — Deployment

Telegraph Sentinel has a production deployment hosted on Render and can also be run locally for development.

## Production endpoints

- **Dashboard / Gateway:** https://telegraph-sentinel-d68u.onrender.com
- **Miner risk assessment:** `POST https://telegraph-sentinel-d68u.onrender.com/api/v1/miner/risk-assessment`
- **TVL lookup:** `POST https://telegraph-sentinel-d68u.onrender.com/api/v1/miner/tvl`
- **Web search:** `POST https://telegraph-sentinel-d68u.onrender.com/api/v1/miner/web-search`
- **Miner specification:** `GET https://telegraph-sentinel-d68u.onrender.com/api/v1/miner/spec.yaml`
- **Health:** `GET https://telegraph-sentinel-d68u.onrender.com/health`
- **Status:** `GET https://telegraph-sentinel-d68u.onrender.com/api/status`

## Render configuration

The production gateway is built from `backend/node`.

| Setting | Value |
|---|---|
| Root directory | `backend/node` |
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| Runtime | Node.js 20 |
| Port | Render-provided `PORT` |
| Environment | `NODE_ENV=production` |
| Telegraph network | `eip155:84532` |

The application listens on the deployment-provided `PORT`; local development defaults to port `4000`.

## Environment variables

Keep secrets and environment-specific configuration in Render environment variables. Do not commit:

- wallet private keys;
- Telegraph API keys;
- Gemini/Tavily provider credentials;
- x402 signing material; or
- production database files.

See [`../.env.example`](../.env.example) for the documented variable names.

## Deployment workflow

1. Push a validated change to `main`.
2. GitHub Actions runs the repository CI checks.
3. Render detects the new commit and builds the Node gateway.
4. Render starts the production service with `npm start`.
5. Verify `/health`, `/api/status`, and the relevant miner intent endpoints.
6. For scoring-sensitive changes, monitor multiple Telegraph epochs before making another change.

## Post-deployment checks

### Health

```bash
curl -fsS https://telegraph-sentinel-d68u.onrender.com/health
```

### Miner specification

```bash
curl -fsS https://telegraph-sentinel-d68u.onrender.com/api/v1/miner/spec.yaml
```

### Crypto intent

```bash
curl -fsS -X POST \
  https://telegraph-sentinel-d68u.onrender.com/api/v1/miner/risk-assessment \
  -H 'Content-Type: application/json' \
  -d '{"asset":"BTC"}'
```

Do not paste production credentials into shell history or public issue/PR discussions.

## Local development

The gateway normally uses:

`http://localhost:4000`

See [`development.md`](development.md) for local setup and testing.

## Protocol artifacts

The checked-in miner specification and WASM scorer are protocol-facing artifacts. Application, documentation, and presentation changes should not silently replace them. Validate scorer changes explicitly with the repository's WASM tooling before any submission or deployment that depends on a new artifact.
