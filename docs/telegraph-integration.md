# Telegraph Miner Integration

## Authoritative Miners Used
* **CoinGecko (Miner 207)**: `CRYPTO_PRICE` — crypto prices and market data.
* **TVL Oracle (Miner 301)**: `TVL_LOOKUP` — protocol metrics and total value locked.
* **Tavily (Miner 202)**: `WEB_SEARCH` — real-time security events, exploit disclosures, and news.

## x402 Payment Negotiation
1. Gateway requests Miner endpoint.
2. If `402 Payment Required` is returned, server retrieves challenge parameters.
3. Server-side signer signs payment against Base Sepolia (`eip155:84532`).
4. Re-submits with `X-PAYMENT` header.
5. Facilitator settles and returns verified Miner output with proof receipt.
