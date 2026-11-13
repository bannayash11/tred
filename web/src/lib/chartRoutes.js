/**
 * Shared chart URL helpers — use everywhere so M&M / NIFTY 50 never break the path.
 * TradingView free embeds use BSE tickers (see toTradingViewSymbol) so NSE never
 * fails open to AAPL.
 */

export function normalizeChartSymbol(symbol) {
  return String(symbol || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
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
