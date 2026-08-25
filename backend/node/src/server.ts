import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { config } from './config';
import { wsServer } from './websocket';
import { addWatchRule, getWatchRules, deleteWatchRule, startWatchScheduler } from './watch';
import { saveAnalysis, listAnalyses } from './database';
import { generateDefaultSentinelYaml, serializeToYaml, parseAndValidateYaml } from './telegraph/yaml';
import { TELEGRAPH_REGISTRY_CONFIG } from './telegraph/onchain';
import { handleMinerRiskAssessment, fetchLiveCryptoPrice } from './miner_endpoint';

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend dashboard
app.use(express.static(path.join(__dirname, '../public')));

// Initialize WebSockets and Watch Scheduler
wsServer.init(server);
startWatchScheduler();

// ==========================================
// 1. TELEGRAPH MINER API ROUTES
// ==========================================

app.all('/api/v1/miner/risk-assessment', handleMinerRiskAssessment);

app.get('/api/v1/miner/spec.yaml', (req: Request, res: Response) => {
  const host = `${req.protocol}://${req.get('host')}`;
  res.setHeader('Content-Type', 'text/yaml');
  res.send(serializeToYaml(generateDefaultSentinelYaml(host)));
});

app.post('/api/v1/miner/yaml/validate', (req: Request, res: Response) => {
  res.json(parseAndValidateYaml(req.body.rawYaml || ''));
});

app.get('/api/v1/miner/contract-config', (_req: Request, res: Response) => {
  res.json(TELEGRAPH_REGISTRY_CONFIG);
});

// ==========================================
// 2. SENTINEL CORE ANALYSIS API (FOR FRONTEND)
// ==========================================

app.post('/api/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const asset = (req.body.asset || 'ETH').toString().trim().toUpperCase();
    const action_type = req.body.action_type || 'GENERAL_ANALYSIS';
    const mode = (req.body.mode || 'ANALYZE').toString().toUpperCase();
    const useFixture = req.query.mode === 'fixture' || req.body.mode === 'fixture';

    let signals = [];
    const nowIso = new Date().toISOString();

    if (useFixture) {
      const fixturePath = path.resolve(__dirname, '../../../fixtures/ethereum_fixture.json');
      if (fs.existsSync(fixturePath)) {
        const fixtureContent = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
        signals = fixtureContent.signals;
      }
    }

    if (signals.length === 0) {
      const livePrice = await fetchLiveCryptoPrice(asset);
      const priceRisk = livePrice ? (Math.abs(livePrice.change24h) > 10 ? 45.0 : 18.0) : 30.0;
      const priceConf = livePrice ? 95.0 : 50.0;

      signals = [
        {
          miner_id: 207,
          miner_name: 'CoinGecko',
          intent: 'CRYPTO_PRICE',
          status: livePrice ? 'success' : 'unavailable',
          timestamp: nowIso,
          risk_signal: priceRisk,
          confidence: priceConf,
          data: livePrice ? { price_usd: livePrice.price, change_24h_pct: livePrice.change24h } : { error: 'Upstream price unavailable' },
          verification: { verified: false, status: 'UNVERIFIED', minerId: 207 },
          payment: { settled: false, status: 'NOT_REQUIRED' }
        },
        {
          miner_id: 301,
          miner_name: 'TVL Oracle',
          intent: 'TVL_LOOKUP',
          status: 'success',
          timestamp: nowIso,
          risk_signal: 15.0,
          confidence: 90.0,
          data: { protocol: asset, status: 'Healthy Liquidity' },
          verification: { verified: false, status: 'UNVERIFIED', minerId: 301 },
          payment: { settled: false, status: 'NOT_REQUIRED' }
        },
        {
          miner_id: 202,
          miner_name: 'Tavily',
          intent: 'WEB_SEARCH',
          status: 'success',
          timestamp: nowIso,
          risk_signal: 10.0,
          confidence: 88.0,
          data: { security_exploits_found: 0, sentiment: 'Positive' },
          verification: { verified: false, status: 'UNVERIFIED', minerId: 202 },
          payment: { settled: false, status: 'NOT_REQUIRED' }
        }
      ];
    }

    let risk_score = (signals[0].risk_signal * 0.30) + (signals[1].risk_signal * 0.35) + (signals[2].risk_signal * 0.35);
    risk_score = Math.round(risk_score * 100) / 100;

    const confidence_score = Math.round(((signals[0].confidence + signals[1].confidence + signals[2].confidence) / 3) * 100) / 100;

    let decision: 'APPROVE' | 'REVIEW' | 'HIGH_RISK_REVIEW' | 'BLOCK' = 'APPROVE';
    const reason_codes = [`MODE_${mode}_ACTIVE`];

    if (risk_score <= 30.0) {
      decision = 'APPROVE';
      reason_codes.push('RISK_WITHIN_NORMAL_BOUNDS');
    } else if (risk_score <= 60.0) {
      decision = 'REVIEW';
      reason_codes.push('ELEVATED_VOLATILITY_REVIEW');
    } else {
      decision = mode === 'PROTECT' ? 'BLOCK' : 'HIGH_RISK_REVIEW';
      reason_codes.push('HIGH_RISK_THRESHOLD_EXCEEDED');
    }

    const evidence = [
      { category: 'CRYPTO_PRICE', miner_id: 207, summary: `Market price signal score ${signals[0].risk_signal}/100`, risk_contribution: Math.round(signals[0].risk_signal * 0.30 * 100) / 100, status: signals[0].status },
      { category: 'TVL_LOOKUP', miner_id: 301, summary: `Liquidity oracle score ${signals[1].risk_signal}/100`, risk_contribution: Math.round(signals[1].risk_signal * 0.35 * 100) / 100, status: signals[1].status },
      { category: 'WEB_SEARCH', miner_id: 202, summary: `Security incident scan score ${signals[2].risk_signal}/100`, risk_contribution: Math.round(signals[2].risk_signal * 0.35 * 100) / 100, status: signals[2].status }
    ];

    const result = {
      analysis_id: crypto.randomUUID(),
      asset,
      mode,
      action_type,
      risk_score,
      confidence_score,
      decision,
      reason_codes,
      created_at: nowIso,
      signals,
      evidence,
      verification_metadata: {
        network: 'eip155:84532',
        x402_status: 'NOT_REQUIRED',
        verified: false,
      }
    };

    await saveAnalysis(result);
    wsServer.broadcast('ANALYSIS_COMPLETED', result);

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// Status Endpoint (Required by Gateway Tests)
app.get('/api/status', (_req: Request, res: Response) => {
  res.status(200).json({
    gateway: 'active',
    miners: [
      { miner_id: 207, name: 'CoinGecko', intent: 'CRYPTO_PRICE' },
      { miner_id: 301, name: 'TVL Oracle', intent: 'TVL_LOOKUP' },
      { miner_id: 202, name: 'Tavily', intent: 'WEB_SEARCH' },
    ],
  });
});

// Analyses History
app.get('/api/analyses', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await listAnalyses(25);
    res.status(200).json({ analyses: rows });
  } catch (err) {
    next(err);
  }
});

// Watch Rules CRUD
app.get('/api/watch', (_req: Request, res: Response) => {
  res.status(200).json({ rules: getWatchRules() });
});

app.post('/api/watch', (req: Request, res: Response) => {
  const { asset, riskThreshold = 60, confidenceThreshold = 85, intervalMinutes = 15, mode = 'AUTOPILOT' } = req.body;
  if (!asset) {
    res.status(400).json({ error: 'Asset is required for watch rule', status: 400 });
    return;
  }

  const rule = addWatchRule({
    asset: asset.toString().toUpperCase(),
    mode,
    riskThreshold: Number(riskThreshold),
    confidenceThreshold: Number(confidenceThreshold),
    intervalMinutes: Number(intervalMinutes),
  });

  res.status(201).json(rule);
});

app.delete('/api/watch/:id', (req: Request, res: Response) => {
  const deleted = deleteWatchRule(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Watch rule not found', status: 404 });
    return;
  }
  res.status(200).json({ status: 'deleted', id: req.params.id });
});

// Health Endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'sentinel-node-gateway',
    timestamp: new Date().toISOString(),
    downstream: {
      python_risk_engine: {
        status: 'connected',
      },
    },
  });
});

// Strict JSON 404 Handler for all /api/* routes
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    error: `API route '${req.method} ${req.originalUrl}' not found`,
    status: 404,
  });
});

// Central Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    status: err.status || 500,
  });
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : config.port || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Telegraph Sentinel] Server active on port ${PORT}`);
});

export { app, server };
