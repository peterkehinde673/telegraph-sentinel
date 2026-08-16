import { config } from '../config';

export interface X402PaymentStatus {
  enabled: boolean;
  network: string;
  walletConfigured: boolean;
  facilitatorUrl: string;
}

export class X402Manager {
  public getStatus(): X402PaymentStatus {
    const hasKey = Boolean(config.x402.walletPrivateKey && config.x402.walletPrivateKey.trim() !== '');
    return {
      enabled: hasKey,
      network: config.telegraph.network,
      walletConfigured: hasKey,
      facilitatorUrl: config.x402.facilitatorUrl,
    };
  }
}

export const x402Manager = new X402Manager();
