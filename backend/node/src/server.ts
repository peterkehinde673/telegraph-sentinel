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
import { generateDefaultSentinelYaml, serializeToYaml, parseAndValidateYaml } from './telegraph/yaml';
import { TELEGRAPH_REGISTRY_CONFIG, validateRegistrationParams, encodeRegistrationTransaction } from './telegraph/onchain';

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Serve Static Frontend directly from Gateway
app.use(express.static(path.join(__dirname, '../public')));

// Initialize WebSocket & Sentinel Watch
wsServer.init(server);
startWatchScheduler();

// Miner signal adapters
const coinGecko = new CoinGeckoAdapter(telegraphClient);
const tvlOracle = new TVLOracleAdapter(telegraphClient);
const tavily = new TavilyAdapter(telegraphClient);

// 1. Gateway Health Check
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
    track: 'Track 1 - Providing Intelligence / Miner',
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

// 2. Gateway Status
app.get('/api/status', (_req: Request, res: Response) => {
  res.json({
    gateway: 'active',
    track1_miner: {
      name: 'Telegraph Sentinel Risk Miner',
      intents: ['CRYPTO_RISK_ASSESSMENT', 'DEFI_PREFLIGHT_AUDIT', 'SECURITY_INCIDENT_SCAN'],
      spec_url: `/api/v1/miner/spec.yaml`,
    },
    miners: [
      { miner_id: 207, name: 'CoinGecko', intent: 'CRYPTO_PRICE' },
      { miner_id: 301, name: 'TVL Oracle', intent: 'TVL_LOOKUP' },
      { miner_id: 202, name: 'Tavily', intent: 'WEB_SEARCH' },
    ],
    x402: x402Manager.getStatus(),
  });
});

// ==========================================
// TRACK 1: TELEGRAPH MINER SPEC & API ROUTES
// ==========================================

// Serve Raw YAML Specification for Telegraph Integrate
app.get('/api/v1/miner/spec.yaml', (req: Request, res: Response) => {
  const host = `${req.protocol}://${req.get('host')}`;
  const spec = generateDefaultSentinelYaml(host);
  const yamlContent = serializeToYaml(spec);
  res.setHeader('Content-Type', 'text/yaml');
  res.send(yamlContent);
});

// Serve JSON Specification
app.get('/api/v1/miner/spec.json', (req: Request, res: Response) => {
  const host = `${req.protocol}://${req.get('host')}`;
  const spec = generateDefaultSentinelYaml(host);
  res.json(spec);
});

// YAML Validation & Hashing Endpoint
app.post('/api/v1/miner/yaml/validate', (req: Request, res: Response) => {
  const { rawYaml } = req.body;
  if (!rawYaml || typeof rawYaml !== 'string') {
    res.status(400).json({ valid: false, errors: ['Request body must contain a rawYaml string'] });
    return;
  }

  const result = parseAndValidateYaml(rawYaml);
  res.json(result);
});

// Base Sepolia Registration Configuration & Calldata Builder
app.get('/api/v1/miner/contract-config', (_req: Request, res: Response) => {
  res.json(TELEGRAPH_REGISTRY_CONFIG);
});

app.post('/api/v1/miner/onchain/encode-register', (req: Request, res: Response) => {
  const validation = validateRegistrationParams(req.body);
  if (!validation.valid) {
    res.status(400).json({ error: 'Validation Error', errors: validation.errors });
    return;
  }

  const encoded = encodeRegistrationTransaction(req.body);
  res.json({
    ...encoded,
    chainIdentifier: TELEGRAPH_REGISTRY_CONFIG.caip2,
    chainId: TELEGRAPH_REGISTRY_CONFIG.chainId,
  });
});

// Live Track 1 Miner Endpoint for Autonomous Agents
app.post('/api/v1/miner/risk-assessment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { asset, mode = 'ANALYZE', action_type = 'GENERAL_ANALYSIS' } = req.body;
    if (!asset || typeof asset !== 'string') {
      res.status(400).json({ error: "Missing required string field 'asset'" });
      return;
    }

    const formattedAsset = asset.toUpperCase();

    // Query upstream miners
    const [priceSig, tvlSig, newsSig] = await Promise.all([
      coinGecko.fetchSignal(formattedAsset),
      tvlOracle.fetchSignal(formattedAsset),
      tavily.fetchSignal(formattedAsset),
    ]);

    const payload = {
      asset: formattedAsset,
      mode,
      action_type,
      signals: [priceSig, tvlSig, newsSig],
    };

    const pyRes = await axios.post(`${config.pythonEngineUrl}/analyze`, payload, { timeout: 5000 });
    wsServer.broadcast('MINER_INTELLIGENCE_DISPATCHED', pyRes.data);

    res.status(200).json({
      miner_id: 'telegraph-sentinel',
      intent: 'CRYPTO_RISK_ASSESSMENT',
      timestamp: new Date().toISOString(),
      evaluation: pyRes.data,
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// CORE SENTINEL GATEWAY ANALYZE ENDPOINTS
// ==========================================

app.post('/api/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = AnalyzeRequestSchema.parse(req.body);
    const asset = parsed.asset.toUpperCase();
    const mode = (req.body.mode || 'ANALYZE').toUpperCase();
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
      mode,
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

// Analysis History
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

// Watch Endpoints
app.post('/api/watch', (req: Request, res: Response) => {
  const { asset, riskThreshold = 60, confidenceThreshold = 85, intervalMinutes = 15, mode = 'AUTOPILOT' } = req.body;
  if (!asset) {
    res.status(400).json({ error: 'Asset is required for watch rule' });
    return;
  }

  const rule = addWatchRule({
    asset: asset.toUpperCase(),
    mode,
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
    console.log(`[Track 1 Miner Spec] http://localhost:${config.port}/api/v1/miner/spec.yaml`);
  });
}

export { app, server };
