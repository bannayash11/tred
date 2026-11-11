const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const orNull = (value) => (finite(value) ? value : null);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseRow(row) {
  if (!Array.isArray(row) || row.length < 17) return null;
  const [
    strike, side, ltp, prevClose, oi, prevOi, volume, prevVolumeLots,
    avgPrice, iv, bid, ask, bidQty, askQty, dayHigh, dayLow, lastTradeAt, delta
  ] = row;
  if (!finite(strike) || strike <= 0 || (side !== 0 && side !== 1)) return null;
  if (!finite(ltp) || !finite(oi) || !finite(volume) || !finite(avgPrice)) return null;
  return {
    strike,
    side: side === 0 ? 'CE' : 'PE',
    ltp,
    prevClose: orNull(prevClose),
    oi,
    prevOi: orNull(prevOi),
    volume,
    prevVolumeLots: orNull(prevVolumeLots),
    avgPrice,
    iv: orNull(iv),
    bid: finite(bid) ? bid : 0,
    ask: finite(ask) ? ask : 0,
    bidQty: finite(bidQty) ? bidQty : 0,
    askQty: finite(askQty) ? askQty : 0,
    dayHigh: orNull(dayHigh),
    dayLow: orNull(dayLow),
    lastTradeAt: orNull(lastTradeAt),
    delta: orNull(delta)
  };
}

export function parseMarketFile(body) {
  if (!body || typeof body !== 'object') return null;
  if (body.schema !== 1 || !finite(body.t) || typeof body.date !== 'string' || !DATE.test(body.date) || !Array.isArray(body.series)) {
    return null;
  }
  const series = [];
  for (const item of body.series) {
    if (!item || typeof item !== 'object') continue;
    if (typeof item.s !== 'string' || (item.k !== 'index' && item.k !== 'stock')) continue;
    if (typeof item.e !== 'string' || !DATE.test(item.e)) continue;
    if (!finite(item.lot) || !finite(item.t) || !finite(item.sp) || item.sp <= 0 || !Array.isArray(item.r)) continue;
    const quotes = item.r.map(parseRow).filter(Boolean);
    series.push({
      symbol: item.s,
      kind: item.k,
      expiry: item.e,
      lot: item.lot,
      at: item.t,
      spot: item.sp,
      spotPrevClose: finite(item.pc) && item.pc > 0 ? item.pc : null,
      atm: finite(item.atm) && item.atm > 0 ? item.atm : null,
      quotes
    });
  }
  return {
    at: body.t,
    date: body.date,
    series,
    minutes: Array.isArray(body.minutes) ? body.minutes : [],
    ladders: body.ladders && typeof body.ladders === 'object' ? body.ladders : {}
  };
}
