import { config } from '../config';

export interface X402Challenge {
  facilitatorUrl: string;
  network: string;
  payTo?: string;
  maxAmountRequired?: string;
  token?: string;
}

export class X402Signer {
  private privateKey: string;
  private network: string;

  constructor() {
    this.privateKey = config.x402.walletPrivateKey;
    this.network = config.telegraph.network; // eip155:84532 (Base Sepolia)
  }

  public isWalletConfigured(): boolean {
    return Boolean(this.privateKey && this.privateKey.trim().length > 0);
  }

  public generatePaymentHeader(challenge: X402Challenge): Record<string, string> {
    if (!this.isWalletConfigured()) {
      throw new Error('Cannot construct x402 payment: WALLET_PRIVATE_KEY is not configured in .env');
    }

    // Standard x402 payment header payload targeting Base Sepolia (eip155:84532)
    const paymentPayload = {
      network: this.network,
      facilitator: challenge.facilitatorUrl || config.x402.facilitatorUrl,
      timestamp: Date.now(),
      payTo: challenge.payTo || '0x0000000000000000000000000000000000000000',
    };

    const encodedHeader = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

    return {
      'X-PAYMENT': encodedHeader,
      'X-PAYMENT-NETWORK': this.network,
    };
  }
}

export const x402Signer = new X402Signer();
