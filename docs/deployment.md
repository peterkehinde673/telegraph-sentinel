# Telegraph Sentinel — Deployment

Telegraph Sentinel has a production deployment hosted on Render and can also be run locally for development.

## Production

- **Dashboard / Gateway:** https://telegraph-sentinel-d68u.onrender.com
- **Miner risk-assessment endpoint:** `https://telegraph-sentinel-d68u.onrender.com/api/v1/miner/risk-assessment`
- **Miner specification endpoint:** `https://telegraph-sentinel-d68u.onrender.com/api/v1/miner/spec.yaml`
- **Status endpoint:** `https://telegraph-sentinel-d68u.onrender.com/api/status`

The production URL is the preferred way to demonstrate the project without keeping a local Termux session running.

## Render configuration

The Node gateway is built from `backend/node`.

Typical settings for the existing deployment are:

- **Root Directory:** `backend/node`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Port:** `4000` (the application reads the deployment-provided port when configured)
- **Environment:** `NODE_ENV=production`
- **Telegraph network:** `eip155:84532` (Base Sepolia)

Keep secrets and environment-specific credentials out of Git. Use Render environment variables for any private configuration required by the runtime.

## Local development

The gateway normally uses:

`http://localhost:4000`

See [`development.md`](development.md) for the local workflow.

## Deployment notes

The repository documentation intentionally points to the production Render URL for public demonstrations while retaining `localhost:4000` only as a local-development reference. No application source code is required to be changed merely to document the production URL.
