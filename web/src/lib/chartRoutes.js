/**
 * Shared chart URL helpers — use everywhere so M&M / NIFTY 50 never break the path.
 */

/** Canonical map so /chart/NIFTY and NIFTY50 resolve to universe key NIFTY 50. */
const CHART_SYMBOL_ALIASES = {
  NIFTY: 'NIFTY 50',
  NIFTY50: 'NIFTY 50',
  'NIFTY FIFTY': 'NIFTY 50',
  'BANK NIFTY': 'BANKNIFTY',
  BANKNIFTY: 'BANKNIFTY',
  BNF: 'BANKNIFTY'
};

export function normalizeChartSymbol(symbol) {
  const code = String(symbol || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  if (!code) return '';
  return CHART_SYMBOL_ALIASES[code] || code;
}

/** Decode a :symbol route param (RR usually decodes once; tolerate raw / double-encoded). */
export function parseChartSymbolParam(param) {
  let raw = String(param || '').trim();
  if (!raw) return '';
  try {
    // Decode until stable (max 2) so M%2526M and M%26M both become M&M
    for (let i = 0; i < 2; i += 1) {
      const next = decodeURIComponent(raw);
      if (next === raw) break;
      raw = next;
    }
  } catch {
    // keep raw
  }
  return normalizeChartSymbol(raw);
}

/** App path to the full chart page, e.g. /chart/M%26M */
export function chartPath(symbol) {
  const code = normalizeChartSymbol(symbol);
  if (!code) return '/terminal';
  return `/chart/${encodeURIComponent(code)}`;
}

/** Login redirect that lands on the chart after auth */
export function chartLoginPath(symbol) {
  return `/login?next=${encodeURIComponent(chartPath(symbol))}`;
}
