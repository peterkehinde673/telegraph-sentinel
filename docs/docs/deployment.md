# Telegraph Sentinel — 24/7 Cloud Deployment Guide

## Production URLs
* **Production Gateway & Dashboard**: https://telegraph-sentinel-d68u.onrender.com
* **Local Development**: http://localhost:4000

## Deploy on Render
1. Connect your GitHub repository: `https://github.com/peterkehinde673/telegraph-sentinel`
2. Build Command: `npm install && npm run build`
3. Start Command: `node dist/server.js`
4. Environment Variables:
   * `PORT=4000`
   * `NODE_ENV=production`
   * `TELEGRAPH_NETWORK=eip155:84532`
