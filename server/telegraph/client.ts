import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { x402Signer } from '../x402/signer';

export interface TelegraphCallParams {
  minerId: number;
  intent: string;
  endpoint: string;
  params?: Record<string, any>;
}

export interface TelegraphVerificationMeta {
  verified: boolean;
  status: 'TELEGRAPH_VERIFIED' | 'UNVERIFIED' | 'UNCONFIGURED' | 'FAILED';
  proof?: string;
  minerId: number;
  network?: string;
}

export interface TelegraphPaymentMeta {
  settled: boolean;
  status: 'NOT_CONFIGURED' | 'PAYMENT_REQUIRED' | 'PAYMENT_AUTHORIZED' | 'PAYMENT_SUBMITTED' | 'SETTLED' | 'PAYMENT_FAILED' | 'UNVERIFIED' | 'NOT_REQUIRED';
  receipt?: string;
  signerAddress?: string;
  network?: string;
  error?: string;
}

export interface TelegraphResponse<T = any> {
  success: boolean;
  data?: T;
  verification: TelegraphVerificationMeta;
  payment: TelegraphPaymentMeta;
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
      timeout: 6000,
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
        error: `Telegraph API key not configured for Miner ${minerReq.minerId} (${minerReq.intent}).`,
        verification: {
          verified: false,
          status: 'UNCONFIGURED',
          minerId: minerReq.minerId,
        },
        payment: {
          settled: false,
          status: 'NOT_CONFIGURED',
        },
      };
    }

    try {
      const response = await this.http.get(minerReq.endpoint, {
        params: minerReq.params,
      });

      const proofHeader = response.headers['x-telegraph-proof'];
      const receiptHeader = response.headers['x-payment-receipt'];

      return {
        success: true,
        status: 'SUCCESS',
        data: response.data,
        verification: {
          verified: Boolean(proofHeader && proofHeader.trim().length > 0),
          status: proofHeader ? 'TELEGRAPH_VERIFIED' : 'UNVERIFIED',
          proof: proofHeader || undefined,
          minerId: minerReq.minerId,
          network: config.telegraph.network,
        },
        payment: {
          settled: Boolean(receiptHeader && receiptHeader.trim().length > 0),
          status: receiptHeader ? 'SETTLED' : 'NOT_REQUIRED',
          receipt: receiptHeader || undefined,
          network: config.telegraph.network,
        },
      };
    } catch (error: any) {
      if (error.response?.status === 402) {
        if (!x402Signer.isWalletConfigured()) {
          return {
            success: false,
            status: 'FAILED',
            error: `x402 Payment Required for Miner ${minerReq.minerId}, but WALLET_PRIVATE_KEY is unconfigured.`,
            verification: {
              verified: false,
              status: 'FAILED',
              minerId: minerReq.minerId,
            },
            payment: {
              settled: false,
              status: 'NOT_CONFIGURED',
              network: config.telegraph.network,
              error: 'Missing or invalid 32-byte WALLET_PRIVATE_KEY in .env',
            },
          };
        }

        const paymentAuth = await x402Signer.preparePaymentHeader({
          facilitatorUrl: config.x402.facilitatorUrl,
          network: config.telegraph.network,
        });

        if (paymentAuth.status !== 'PAYMENT_AUTHORIZED') {
          return {
            success: false,
            status: 'FAILED',
            error: paymentAuth.error,
            verification: { verified: false, status: 'FAILED', minerId: minerReq.minerId },
            payment: { settled: false, status: 'PAYMENT_FAILED', error: paymentAuth.error },
          };
        }

        try {
          const retryResponse = await this.http.get(minerReq.endpoint, {
            params: minerReq.params,
            headers: paymentAuth.headers,
          });

          const proofHeader = retryResponse.headers['x-telegraph-proof'];
          const receiptHeader = retryResponse.headers['x-payment-receipt'];
          const isSettled = Boolean(receiptHeader && receiptHeader.trim().length > 0);

          return {
            success: true,
            status: 'SUCCESS',
            data: retryResponse.data,
            verification: {
              verified: Boolean(proofHeader && proofHeader.trim().length > 0),
              status: proofHeader ? 'TELEGRAPH_VERIFIED' : 'UNVERIFIED',
              proof: proofHeader || undefined,
              minerId: minerReq.minerId,
              network: config.telegraph.network,
            },
            payment: {
              settled: isSettled,
              status: isSettled ? 'SETTLED' : 'UNVERIFIED',
              receipt: receiptHeader || undefined,
              signerAddress: paymentAuth.signerAddress,
              network: config.telegraph.network,
            },
          };
        } catch (retryError: any) {
          return {
            success: false,
            status: 'FAILED',
            error: `x402 payment authorization rejected by facilitator: ${retryError.message}`,
            verification: { verified: false, status: 'FAILED', minerId: minerReq.minerId },
            payment: {
              settled: false,
              status: 'PAYMENT_FAILED',
              signerAddress: paymentAuth.signerAddress,
              error: retryError.message,
            },
          };
        }
      }

      return {
        success: false,
        status: 'FAILED',
        error: `Miner ${minerReq.minerId} query failed: ${error.message}`,
        verification: { verified: false, status: 'FAILED', minerId: minerReq.minerId },
        payment: { settled: false, status: 'PAYMENT_FAILED', error: error.message },
      };
    }
  }
}

export const telegraphClient = new TelegraphClient();
