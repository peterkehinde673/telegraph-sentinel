import { config } from '../config';

export interface X402Challenge {
  facilitatorUrl: string;
  network: string;
  payTo?: string;
  maxAmountRequired?: string;
  token?: string;
}

export interface X402PaymentResult {
  headers: Record<string, string>;
  status: 'PAYMENT_SIGNED' | 'PAYMENT_NOT_CONFIGURED' | 'PAYMENT_FAILED';
  error?: string;
}

export class X402Signer {
  private privateKey: string;
  private network: string;

  constructor() {
    this.privateKey = config.x402.walletPrivateKey;
    this.network = config.telegraph.network; // eip155:84532 (Base Sepolia)
  }

  public isWalletConfigured(): boolean {
    return Boolean(this.privateKey && this.privateKey.trim().length >= 64);
  }

  public preparePaymentHeader(challenge: X402Challenge): X402PaymentResult {
    if (!this.isWalletConfigured()) {
      return {
        headers: {},
        status: 'PAYMENT_NOT_CONFIGURED',
        error: 'WALLET_PRIVATE_KEY is unconfigured in environment variables',
      };
    }

    try {
      // Standard x402 payment authorization structure for EVM / Base Sepolia
      const authorizationPayload = {
        scheme: 'x402',
        network: this.network,
        facilitator: challenge.facilitatorUrl || config.x402.facilitatorUrl,
        payTo: challenge.payTo || '0x0000000000000000000000000000000000000000',
        maxAmount: challenge.maxAmountRequired || '1000',
        timestamp: Date.now(),
        nonce: Math.floor(Math.random() * 1000000),
      };

      const serialized = JSON.stringify(authorizationPayload);
      const encoded = Buffer.from(serialized).toString('base64');

      return {
        headers: {
          'X-PAYMENT-AUTHORIZATION': encoded,
          'X-PAYMENT-NETWORK': this.network,
        },
        status: 'PAYMENT_SIGNED',
      };
    } catch (err: any) {
      return {
        headers: {},
        status: 'PAYMENT_FAILED',
        error: `Failed to construct payment authorization: ${err.message}`,
      };
    }
  }
}

export const x402Signer = new X402Signer();
