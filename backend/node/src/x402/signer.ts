import { ethers } from 'ethers';
import { config } from '../config';

export interface X402Challenge {
  facilitatorUrl: string;
  network: string;
  payTo?: string;
  maxAmountRequired?: string;
  challengeDigest?: string;
}

export interface X402PaymentResult {
  headers: Record<string, string>;
  status: 'NOT_CONFIGURED' | 'PAYMENT_AUTHORIZED' | 'PAYMENT_FAILED';
  signerAddress?: string;
  signature?: string;
  error?: string;
}

export class X402Signer {
  private network: string;

  constructor() {
    this.network = config.telegraph.network;
  }

  public isWalletConfigured(): boolean {
    const key = config.x402.walletPrivateKey?.trim();
    if (!key) return false;
    const sanitized = key.startsWith('0x') ? key.slice(2) : key;
    return sanitized.length === 64 && /^[0-9a-fA-F]+$/.test(sanitized);
  }

  public async preparePaymentHeader(challenge: X402Challenge): Promise<X402PaymentResult> {
    if (!this.isWalletConfigured()) {
      return {
        headers: {},
        status: 'NOT_CONFIGURED',
        error: 'WALLET_PRIVATE_KEY is unconfigured or not a valid 32-byte hex key in environment variables',
      };
    }

    try {
      const key = config.x402.walletPrivateKey.trim();
      const formattedKey = key.startsWith('0x') ? key : `0x${key}`;
      const wallet = new ethers.Wallet(formattedKey);
      const signerAddress = wallet.address;

      const timestamp = Date.now();
      const facilitator = challenge.facilitatorUrl || config.x402.facilitatorUrl;
      const payTo = challenge.payTo || ethers.ZeroAddress;
      const maxAmount = challenge.maxAmountRequired || '1000';

      const messageToSign = `x402:pay:${this.network}:${facilitator}:${payTo}:${maxAmount}:${timestamp}`;
      const signature = await wallet.signMessage(messageToSign);

      const authPayload = {
        scheme: 'x402-evm-ecdsa',
        network: this.network,
        signer: signerAddress,
        facilitator,
        payTo,
        maxAmount,
        timestamp,
        signature,
      };

      return {
        headers: {
          'X-Payment-Authorization': Buffer.from(JSON.stringify(authPayload)).toString('base64'),
          'X-Payment-Signature': signature,
          'X-Payment-Signer': signerAddress,
          'X-Payment-Network': this.network,
        },
        status: 'PAYMENT_AUTHORIZED',
        signerAddress,
        signature,
      };
    } catch (err: any) {
      return {
        headers: {},
        status: 'PAYMENT_FAILED',
        error: `Cryptographic signing failed: ${err.message}`,
      };
    }
  }
}

export const x402Signer = new X402Signer();
