import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  telegraph: {
    apiUrl: process.env.TELEGRAPH_API_URL || 'https://api.telegraph.im',
    apiKey: process.env.TELEGRAPH_API_KEY || '',
    network: process.env.TELEGRAPH_NETWORK || 'eip155:84532',
  },
  x402: {
    walletPrivateKey: process.env.WALLET_PRIVATE_KEY || '',
    facilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://facilitator.x402.org',
  },
};
