import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import { AnalyzeRequestSchema } from './types';
import { telegraphClient } from './telegraph/client';
import { CoinGeckoAdapter, TVLOracleAdapter, TavilyAdapter } from './telegraph/adapters';
import { wsServer } from './websocket';
import { x402Manager } from './x402/payment';
import { addWatchRule, getWatchRules, deleteWatchRule, startWatchScheduler } from './watch';

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Serve Static Frontend directly from Gateway (100% native Termux compatible)
app.use(express.static(path.join(__dirname, '../public')));

// Initialize WebSocket & Sentinel Watch
wsServer.init(server);
startWatchScheduler();

// Adapters
const coinGecko = new CoinGeckoAdapter(telegraphClient);
const tvlOracle = new TVLOracleAdapter(telegraphClient);
const tavily = new TavilyAdapter(telegraphClient);

// 1. Health
app.get('/health', async (_req: Request, res: Response) => {
  let pythonStatus = 'disconnected';
  let pythonDetails = null;

  try {
    const pyRes = await axios.get(`${config.pythonEngineUrl}/health`, { timeout: 2000 });
    if (pyRes.status === 200) {
      pythonStatus = 'connected';
      pythonDetails = pyRes.data;
    }
  } catch (err: any) {
    pythonStatus = `unreachable (${err.message || 'connection failed'})`;
  }

  res.status(200).json({
    status: 'healthy',
    service: 'sentinel-node-gateway',
    timestamp: new Date().toISOString(),
    telegraph: {
      configured: telegraphClient.isConfigured(),
      network: config.telegraph.network,
    },
    x402: x402Manager.getStatus(),
    downstream: {
      python_risk_engine: {
        status: pythonStatus,
        details: pythonDetails,
      },
    },
  });
});

// 2. Status
app.get('/api/status', (_req: Request, res: Response) => {
  res.json({
    gateway: 'active',
    miners: [
      { miner_id: 207, name: 'CoinGecko', intent: 'CRYPTO_PRICE' },
      { miner_id: 301, name: 'TVL Oracle', intent: 'TVL_LOOKUP' },
      { miner_id: 202, name: 'Tavily', intent: 'WEB_SEARCH' },
    ],
    x402: x402Manager.getStatus(),
  });
});

// 3. Analyze Endpoint (with development fixture support)
app.post('/api/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = AnalyzeRequestSchema.parse(req.body);
    const asset = parsed.asset.toUpperCase();
    const useDevFixture = req.query.mode === 'fixture' || req.body.mode === 'fixture';

    let signals = [];

    if (useDevFixture) {
      const fixturePath = path.resolve(__dirname, '../../../fixtures/ethereum_fixture.json');
      if (fs.existsSync(fixturePath)) {
        const fixtureContent = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
        signals = fixtureContent.signals;
      }
    }

    if (signals.length === 0) {
      const [priceSignal, tvlSignal, newsSignal] = await Promise.all([
        coinGecko.fetchSignal(asset),
        tvlOracle.fetchSignal(asset),
        tavily.fetchSignal(asset),
      ]);
      signals = [priceSignal, tvlSignal, newsSignal];
    }

    const payload = {
      asset,
      action_type: parsed.action_type,
      signals,
    };

    const pyRes = await axios.post(`${config.pythonEngineUrl}/analyze`, payload, {
      timeout: 5000,
    });

    wsServer.broadcast('ANALYSIS_COMPLETED', pyRes.data);
    res.status(200).json(pyRes.data);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Validation Error', details: error.errors });
      return;
    }
    next(error);
  }
});

// 4. Analysis History
app.get('/api/analyses', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const pyRes = await axios.get(`${config.pythonEngineUrl}/analyses`, { timeout: 3000 });
    res.json(pyRes.data);
  } catch (err) {
    next(err);
  }
});

app.get('/api/analysis/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pyRes = await axios.get(`${config.pythonEngineUrl}/analysis/${req.params.id}`, { timeout: 3000 });
    res.json(pyRes.data);
  } catch (err: any) {
    if (err.response?.status === 404) {
      res.status(404).json({ error: 'Analysis record not found' });
      return;
    }
    next(err);
  }
});

// 5. Watch Endpoints
app.post('/api/watch', (req: Request, res: Response) => {
  const { asset, riskThreshold = 60, confidenceThreshold = 85, intervalMinutes = 15 } = req.body;
  if (!asset) {
    res.status(400).json({ error: 'Asset is required for watch rule' });
    return;
  }

  const rule = addWatchRule({
    asset: asset.toUpperCase(),
    riskThreshold: Number(riskThreshold),
    confidenceThreshold: Number(confidenceThreshold),
    intervalMinutes: Number(intervalMinutes),
  });

  res.status(201).json(rule);
});

app.get('/api/watch', (_req: Request, res: Response) => {
  res.json({ rules: getWatchRules() });
});

app.delete('/api/watch/:id', (req: Request, res: Response) => {
  const success = deleteWatchRule(req.params.id);
  if (!success) {
    res.status(404).json({ error: 'Watch rule not found' });
    return;
  }
  res.json({ status: 'deleted', id: req.params.id });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.status || 500).json({
    error: 'Gateway Error',
    message: err.message || 'Internal server error',
  });
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(config.port, () => {
    console.log(`[Sentinel Gateway] Running UI and API on http://localhost:${config.port}`);
  });
}

export { app, server };
