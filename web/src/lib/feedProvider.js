/** Normalize platform / BYOK feed metadata from API or socket. */

const LABELS = {
  kotak: 'Kotak',
  fyers: 'Fyers',
  upstox: 'Upstox',
  groww: 'Groww',
  angelone: 'Angel One'
};

export function normalizeFeedMeta(feed, fallback = null) {
  if (!feed || typeof feed !== 'object') return fallback;
  const provider = String(feed.provider || '').toLowerCase().trim() || null;
  const mode = String(feed.mode || '').toLowerCase().trim() || null;
  const label =
    feed.label ||
    (provider
      ? mode === 'byok'
        ? `BYOK · ${LABELS[provider] || provider}`
        : `Platform · ${LABELS[provider] || provider}`
      : null);
  return {
    mode,
    provider,
    label,
    live: feed.live === true,
    chartProvider: feed.chartProvider || provider || null
  };
}

export function providerShortName(provider) {
  const p = String(provider || '').toLowerCase();
  return LABELS[p] || (p ? p : 'Broker');
}

/** Prefer stock response feed, then layout socket feed. */
export function pickChartFeed({ stockFeed, responseFeed, layoutFeed, chartProvider } = {}) {
  const merged = normalizeFeedMeta(responseFeed) ||
    normalizeFeedMeta(stockFeed) ||
    normalizeFeedMeta(layoutFeed);
  if (!merged) {
    return chartProvider
      ? {
          mode: 'server',
          provider: chartProvider,
          label: `Platform · ${providerShortName(chartProvider)}`,
          chartProvider
        }
      : null;
  }
  if (chartProvider && !merged.chartProvider) {
    merged.chartProvider = chartProvider;
  }
  return merged;
}
