import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { x402Signer } from '../x402/signer';

export interface TelegraphCallParams {
  minerId: number;
  intent: string;
  endpoint: string;
  params?: Record<string, any>;
}

export interface TelegraphResponse<T = any> {
  success: boolean;
  data?: T;
  verification?: Record<string, any>;
  payment?: Record<string, any>;
  error?: string;
  status: 'SUCCESS' | 'FAILED' | 'UNCONFIGURED';
}

export class TelegraphClient {
  private http: AxiosInstance;
  private hasApiKey: boolean;

  constructor() {
    this.hasApiKey = Boolean(config.telegraph.apiKey && config.telegraph.apiKey.trim() !== '');
    this.http = axios.create({
      baseURL: config.telegraph.apiUrl,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.hasApiKey ? { Authorization: `Bearer ${config.telegraph.apiKey}` } : {}),
      },
    });
  }

  public isConfigured(): boolean {
    return this.hasApiKey;
  }

  public async queryMiner<T = any>(minerReq: TelegraphCallParams): Promise<TelegraphResponse<T>> {
    if (!this.hasApiKey) {
      return {
        success: false,
        status: 'UNCONFIGURED',
        error: `Telegraph API key not configured for Miner ${minerReq.minerId} (${minerReq.intent}). Live request deferred.`,
      };
    }

    try {
      // 1. First attempt
      const response = await this.http.get(minerReq.endpoint, {
        params: minerReq.params,
      });

      return {
        success: true,
        status: 'SUCCESS',
        data: response.data,
        verification: response.headers['x-telegraph-proof']
          ? { proof: response.headers['x-telegraph-proof'], network: config.telegraph.network }
          : { verified_miner_id: minerReq.minerId, network: config.telegraph.network },
        payment: response.headers['x-payment-receipt']
          ? { receipt: response.headers['x-payment-receipt'] }
          : {},
      };
    } catch (error: any) {
      // 2. Handle x402 challenge flow
      if (error.response?.status === 402) {
        if (!x402Signer.isWalletConfigured()) {
          return {
            success: false,
            status: 'FAILED',
            error: `x402 Payment Required for Miner ${minerReq.minerId}, but WALLET_PRIVATE_KEY is unconfigured`,
            payment: { status: 'PAYMENT_REQUIRED', network: config.telegraph.network },
          };
        }

        try {
          // Construct payment authorization header and retry
          const paymentHeaders = x402Signer.generatePaymentHeader({
            facilitatorUrl: config.x402.facilitatorUrl,
            network: config.telegraph.network,
          });

          const retryResponse = await this.http.get(minerReq.endpoint, {
            params: minerReq.params,
            headers: paymentHeaders,
          });

          return {
            success: true,
            status: 'SUCCESS',
            data: retryResponse.data,
            verification: { verified_miner_id: minerReq.minerId, network: config.telegraph.network },
            payment: {
              settled: true,
              network: config.telegraph.network,
              receipt: retryResponse.headers['x-payment-receipt'] || '0x_x402_settlement_confirmed',
            },
          };
        } catch (retryError: any) {
          return {
            success: false,
            status: 'FAILED',
            error: `x402 settlement failed for Miner ${minerReq.minerId}: ${retryError.message}`,
          };
        }
      }

      return {
        success: false,
        status: 'FAILED',
        error: `Miner ${minerReq.minerId} query failed: ${error.message}`,
      };
    }
  }
}

export const telegraphClient = new TelegraphClient();
