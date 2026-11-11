export function combineMonths(symbol, months) {
  const near = months?.[0];
  if (!near) return null;
  const others = months.slice(1).map((month) => ({ ...month, cursor: -1 }));
  const candles = (near.candles || []).map((candle) => {
    let oi = candle.oi || 0;
    for (const month of others) {
      while (month.cursor + 1 < (month.candles?.length || 0) && month.candles[month.cursor + 1].at <= candle.at) {
        month.cursor++;
      }
      oi += month.cursor >= 0 ? month.candles[month.cursor].oi : month.prevOi ?? 0;
    }
    return { at: candle.at, close: candle.close, oi };
  });
  const prevOi = near.prevOi == null ? null : months.reduce((sum, month) => sum + (month.prevOi ?? 0), 0);
  return {
    symbol,
    contractDate: near.date,
    months: months.map((m) => m.date),
    prevClose: near.prevClose,
    prevOi,
    candles
  };
}

export function futuresBuildUp(priceChange, oiChange) {
  if (!(Math.abs(priceChange) > 1e-9) || !(Math.abs(oiChange) > 0)) return 'NEUTRAL';
  if (priceChange > 0) return oiChange > 0 ? 'LONG_BUILD' : 'SHORT_COVER';
  return oiChange > 0 ? 'SHORT_BUILD' : 'LONG_UNWIND';
}

export function readFuturesDay(series) {
  const last = series?.candles?.at?.(-1);
  if (!last || !(last.close > 0)) return null;
  const priceFrom = series.prevClose;
  const oiFrom = series.prevOi;
  if (priceFrom == null || !(priceFrom > 0) || oiFrom == null || !(oiFrom >= 0)) return null;
  const priceChange = last.close - priceFrom;
  const oiChange = last.oi - oiFrom;
  return {
    contractDate: series.contractDate,
    price: last.close,
    priceFrom,
    priceChange,
    priceChangePct: (priceChange / priceFrom) * 100,
    oi: last.oi,
    oiFrom,
    oiChange,
    oiChangePct: oiFrom > 0 ? (oiChange / oiFrom) * 100 : null,
    buildUp: futuresBuildUp(priceChange, oiChange)
  };
}

export const BUILD_LABELS = {
  LONG_BUILD: 'Long build-up',
  SHORT_BUILD: 'Short build-up',
  SHORT_COVER: 'Short covering',
  LONG_UNWIND: 'Long unwinding',
  NEUTRAL: 'Neutral'
};
