import axios from 'axios';
import { wsServer } from './websocket';
import { config } from './config';

export interface WatchRule {
  id: string;
  asset: string;
  mode?: string;
  riskThreshold: number;
  confidenceThreshold: number;
  intervalMinutes: number;
  lastChecked?: string;
  status: 'ACTIVE' | 'PAUSED';
}

const activeWatchRules: Map<string, WatchRule> = new Map();
let monitorTimer: NodeJS.Timeout | null = null;

export function addWatchRule(rule: Omit<WatchRule, 'id' | 'status'>): WatchRule {
  const id = `watch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newRule: WatchRule = {
    ...rule,
    mode: rule.mode || 'AUTOPILOT',
    id,
    status: 'ACTIVE',
  };
  activeWatchRules.set(id, newRule);
  return newRule;
}

export function getWatchRules(): WatchRule[] {
  return Array.from(activeWatchRules.values());
}

export function deleteWatchRule(id: string): boolean {
  return activeWatchRules.delete(id);
}

export function startWatchScheduler() {
  if (monitorTimer) return;
  
  monitorTimer = setInterval(async () => {
    const now = new Date();
    for (const rule of activeWatchRules.values()) {
      if (rule.status !== 'ACTIVE') continue;

      try {
        const response = await axios.post(`http://127.0.0.1:${config.port}/api/analyze`, {
          asset: rule.asset,
          mode: rule.mode || 'AUTOPILOT',
          action_type: 'WATCH_MONITOR',
        });

        const result = response.data;
        rule.lastChecked = now.toISOString();

        const isRiskAlert = result.risk_score >= rule.riskThreshold;
        const isConfidenceAlert = result.confidence_score < rule.confidenceThreshold;

        if (isRiskAlert || isConfidenceAlert) {
          wsServer.broadcast('WATCH_ALERT', {
            rule_id: rule.id,
            asset: rule.asset,
            mode: rule.mode,
            trigger_reason: isRiskAlert
              ? `Risk score (${result.risk_score}) exceeded threshold (${rule.riskThreshold})`
              : `Confidence (${result.confidence_score}) dropped below threshold (${rule.confidenceThreshold})`,
            analysis: result,
          });
        }
      } catch (err: any) {
        console.error(`[Sentinel Watch] Error monitoring ${rule.asset}:`, err.message);
      }
    }
  }, 30000);
}
