import { readFuturesDay } from './futuresModel';

const FLOOR_PCT = 0.5;

function optionsSummary(series) {
  let putOi = 0;
  let callOi = 0;
  let putOiAdded = 0;
  let callOiAdded = 0;
  let hasPrev = false;
  const byStrike = new Map();

  for (const q of series.quotes) {
    if (!(q.oi > 0)) continue;
    if (q.side === 'PE') {
      putOi += q.oi;
      if (q.prevOi != null) {
        hasPrev = true;
        putOiAdded += q.oi - q.prevOi;
      }
    } else {
      callOi += q.oi;
      if (q.prevOi != null) {
        hasPrev = true;
        callOiAdded += q.oi - q.prevOi;
      }
    }
    const row = byStrike.get(q.strike) || { strike: q.strike, put: 0, call: 0 };
    if (q.side === 'PE') row.put += q.oi;
    else row.call += q.oi;
    byStrike.set(q.strike, row);
  }

  const rows = [...byStrike.values()].sort((a, b) => a.strike - b.strike);
  const below = rows.filter((r) => r.strike <= series.spot).slice(-8);
  const above = rows.filter((r) => r.strike > series.spot).slice(0, 8);
  const support = below.length
    ? below.reduce((best, r) => (r.put + r.call > best.put + best.call ? r : best))
    : null;
  const resistance = above.length
    ? above.reduce((best, r) => (r.put + r.call > best.put + best.call ? r : best))
    : null;

  return {
    putOi,
    callOi,
    putOiAdded: hasPrev ? putOiAdded : null,
    callOiAdded: hasPrev ? callOiAdded : null,
    pcr: callOi > 0 ? putOi / callOi : null,
    support: support
      ? { strike: support.strike, oi: support.put + support.call, distancePct: ((support.strike - series.spot) / series.spot) * 100 }
      : null,
    resistance: resistance
      ? {
          strike: resistance.strike,
          oi: resistance.put + resistance.call,
          distancePct: ((resistance.strike - series.spot) / series.spot) * 100
        }
      : null,
    profile: [...below, ...above]
  };
}

export function buildFlowRows(market, futuresMap) {
  if (!market) return { bullish: [], bearish: [], rangebound: [], pending: [] };

  const bullish = [];
  const bearish = [];
  const rangebound = [];
  const pending = [];

  for (const series of market.series) {
    const futSeries = futuresMap.get(series.symbol);
    const fut = futSeries ? readFuturesDay(futSeries) : null;
    const spotChangePct =
      series.spotPrevClose > 0 ? ((series.spot / series.spotPrevClose) - 1) * 100 : null;
    const changePct = fut?.priceChangePct ?? (spotChangePct != null ? spotChangePct : null);
    const source = fut ? 'futures' : spotChangePct != null ? 'spot' : null;
    const opts = optionsSummary(series);

    let side = null;
    if (changePct != null) {
      if (changePct >= FLOOR_PCT) side = 'bullish';
      else if (changePct <= -FLOOR_PCT) side = 'bearish';
      else side = 'rangebound';
    }

    const row = {
      symbol: series.symbol,
      kind: series.kind,
      expiry: series.expiry,
      spot: series.spot,
      prevClose: series.spotPrevClose,
      spotChangePct,
      changePct,
      source,
      fut,
      buildUp: fut?.buildUp || null,
      oiChangePct: fut?.oiChangePct ?? null,
      options: opts,
      side,
      futures: fut ? 'read' : futuresMap.has(series.symbol) ? 'unavailable' : 'pending'
    };

    if (side === 'bullish') bullish.push(row);
    else if (side === 'bearish') bearish.push(row);
    else if (side === 'rangebound') rangebound.push(row);
    else pending.push(row);
  }

  const byMove = (a, b) => Math.abs(b.changePct || 0) - Math.abs(a.changePct || 0);
  bullish.sort(byMove);
  bearish.sort(byMove);
  rangebound.sort(byMove);

  return { bullish, bearish, rangebound, pending, at: market.at, date: market.date };
}
