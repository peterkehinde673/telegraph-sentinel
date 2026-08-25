import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import { wsServer } from './websocket';
import { startWatchScheduler } from './watch';
import { generateDefaultSentinelYaml, serializeToYaml, parseAndValidateYaml } from './telegraph/yaml';
import { TELEGRAPH_REGISTRY_CONFIG } from './telegraph/onchain';
import { handleMinerRiskAssessment } from './miner_endpoint';

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

wsServer.init(server);
startWatchScheduler();

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

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'sentinel-node-gateway' });
});

server.listen(config.port, '0.0.0.0', () => {
  console.log(`[Sentinel] Live Miner active on port ${config.port}`);
});

export { app, server };
