import { createUpstoxEquityAdapter } from './upstoxEquity.js';
import { createKotakByokAdapter } from './kotakByok.js';
import { createGrowwAdapter } from './groww.js';
import { createAngelOneAdapter } from './angelone.js';

/**
 * Build a market adapter for a resolved BYOK feed.
 */
export async function createByokMarketAdapter({ provider, session, secrets, symbols = [] }) {
  let adapter;
  if (provider === 'upstox') {
    adapter = createUpstoxEquityAdapter({
      accessToken: session?.accessToken || secrets?.accessToken
    });
  } else if (provider === 'kotak') {
    adapter = createKotakByokAdapter({ session, secrets });
  } else if (provider === 'groww') {
    adapter = createGrowwAdapter({ session, secrets });
  } else if (provider === 'angelone') {
    adapter = createAngelOneAdapter({ session, secrets });
  } else {
    const err = new Error(`Unsupported BYOK broker: ${provider || 'unknown'}`);
    err.statusCode = 400;
    throw err;
  }

  await adapter.init(symbols);
  return adapter;
}
