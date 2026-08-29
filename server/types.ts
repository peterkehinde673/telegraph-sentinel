import { z } from 'zod';

export const AnalyzeRequestSchema = z.object({
  asset: z.string().min(1, 'Asset symbol/name is required'),
  action_type: z.string().default('GENERAL_ANALYSIS'),
});

export type AnalyzeRequestDto = z.infer<typeof AnalyzeRequestSchema>;

export type SignalStatus = 'success' | 'failed' | 'unavailable';

export interface NormalizedSignal {
  miner_id: number;
  miner_name: string;
  intent: 'CRYPTO_PRICE' | 'TVL_LOOKUP' | 'WEB_SEARCH';
  status: SignalStatus;
  timestamp: string;
  risk_signal: number;
  confidence: number;
  data: Record<string, any>;
  verification: Record<string, any>;
  payment: Record<string, any>;
  raw_response?: Record<string, any>;
}
