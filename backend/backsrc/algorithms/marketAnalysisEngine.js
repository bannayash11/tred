/**
 * Market Analysis Engine
 * Builds directional bias + fixed pivot / support-resistance levels from OHLC.
 * Scenario planning only — not a price guarantee.
 */

const IST_TZ = 'Asia/Kolkata';

function candleUnix(c) {
  if (Number.isFinite(c?._unix) && c._unix > 0) return c._unix;
  if (typeof c?.time === 'number') return c.time;
  if (typeof c?.time === 'string') {
    return Math.floor(new Date(`${c.time}T00:00:00+05:30`).getTime() / 1000);
  }
  return 0;
}

function istYmd(unixSec) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(unixSec * 1000));
}

function roundPx(v, digits = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(digits));
}

function pct(from, to) {
  if (!from || !Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return ((to - from) / from) * 100;
}

/** Group 5m/intraday candles into daily OHLC sessions (IST). */
export function buildDailyBars(candles = []) {
  const map = new Map();
  for (const c of candles) {
    const t = candleUnix(c);
    if (!t) continue;
    const day = istYmd(t);
    const prev = map.get(day);
    if (!prev) {
      map.set(day, {
        date: day,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 0,
        _sort: t
      });
    } else {
      prev.high = Math.max(prev.high, c.high);
      prev.low = Math.min(prev.low, c.low);
      prev.close = c.close;
      prev.volume += c.volume || 0;
    }
  }
  return [...map.values()].sort((a, b) => a._sort - b._sort);
}

/** Classic floor-trader pivots from a prior day OHLC. */
export function classicPivots(dayBar) {
  if (!dayBar) return null;
  const H = dayBar.high;
  const L = dayBar.low;
  const C = dayBar.close;
  const range = H - L;
  if (!Number.isFinite(range) || range <= 0) return null;
  const pp = (H + L + C) / 3;
  return {
    sourceDate: dayBar.date,
    pp: roundPx(pp),
    r1: roundPx(2 * pp - L),
    r2: roundPx(pp + range),
    r3: roundPx(H + 2 * (pp - L)),
    s1: roundPx(2 * pp - H),
    s2: roundPx(pp - range),
    s3: roundPx(L - 2 * (H - pp))
  };
}

/** Camarilla pivots — useful for intraday reaction levels. */
export function camarillaPivots(dayBar) {
  if (!dayBar) return null;
  const H = dayBar.high;
  const L = dayBar.low;
  const C = dayBar.close;
  const range = H - L;
  if (!Number.isFinite(range) || range <= 0) return null;
  return {
    sourceDate: dayBar.date,
    h3: roundPx(C + (range * 1.1) / 4),
    h4: roundPx(C + (range * 1.1) / 2),
    l3: roundPx(C - (range * 1.1) / 4),
    l4: roundPx(C - (range * 1.1) / 2)
  };
}

function findSwings(candles, lookback = 3) {
  const highs = [];
  const lows = [];
  const k = Math.min(lookback, 3);
  for (let i = k; i < candles.length - k; i++) {
    const cur = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= k; j++) {
      if (candles[i - j].high >= cur.high || candles[i + j].high >= cur.high) isHigh = false;
      if (candles[i - j].low <= cur.low || candles[i + j].low <= cur.low) isLow = false;
    }
    if (isHigh) highs.push({ index: i, price: cur.high, time: cur.time });
    if (isLow) lows.push({ index: i, price: cur.low, time: cur.time });
  }
  return { highs, lows };
}

function structureBias(candles) {
  if (!candles || candles.length < 8) {
    return { bias: 'NEUTRAL', score: 0, label: 'Insufficient structure' };
  }
  const { highs, lows } = findSwings(candles, 3);
  const lastHighs = highs.slice(-3);
  const lastLows = lows.slice(-3);
  let hh = 0;
  let lh = 0;
  let hl = 0;
  let ll = 0;
  for (let i = 1; i < lastHighs.length; i++) {
    if (lastHighs[i].price > lastHighs[i - 1].price) hh += 1;
    else if (lastHighs[i].price < lastHighs[i - 1].price) lh += 1;
  }
  for (let i = 1; i < lastLows.length; i++) {
    if (lastLows[i].price > lastLows[i - 1].price) hl += 1;
    else if (lastLows[i].price < lastLows[i - 1].price) ll += 1;
  }
  const bull = hh + hl;
  const bear = lh + ll;
  if (bull > bear + 0) {
    return { bias: 'UP', score: Math.min(40, 12 + bull * 8), label: 'Higher highs / higher lows' };
  }
  if (bear > bull + 0) {
    return {
      bias: 'DOWN',
      score: -Math.min(40, 12 + bear * 8),
      label: 'Lower highs / lower lows'
    };
  }
  return { bias: 'RANGE', score: 0, label: 'Mixed swing structure' };
}

function momentumScore(candles, currentPrice) {
  if (!candles?.length || !currentPrice) return { score: 0, rsi: 50, movePct: 0 };
  const n = Math.min(14, candles.length - 1);
  const slice = candles.slice(-(n + 1));
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const d = slice[i].close - slice[i - 1].close;
    if (d >= 0) gains += d;
    else losses -= d;
  }
  const avgGain = gains / n;
  const avgLoss = losses / n || 1e-9;
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  const look = candles.slice(-12);
  const movePct = pct(look[0]?.close || currentPrice, currentPrice);
  let score = 0;
  if (rsi >= 58) score += 12;
  else if (rsi <= 42) score -= 12;
  if (movePct >= 0.35) score += 10;
  else if (movePct <= -0.35) score -= 10;
  return { score, rsi: roundPx(rsi, 1), movePct: roundPx(movePct, 2) };
}

function nearestLevels(price, pivots, camarilla, swings) {
  const pool = [];
  if (pivots) {
    for (const [key, val] of Object.entries(pivots)) {
      if (key === 'sourceDate' || val == null) continue;
      pool.push({
        id: `PIVOT_${key.toUpperCase()}`,
        label: key.toUpperCase(),
        price: val,
        family: 'classic'
      });
    }
  }
  if (camarilla) {
    for (const [key, val] of Object.entries(camarilla)) {
      if (key === 'sourceDate' || val == null) continue;
      pool.push({
        id: `CAM_${key.toUpperCase()}`,
        label: `Cam ${key.toUpperCase()}`,
        price: val,
        family: 'camarilla'
      });
    }
  }
  for (const s of swings.highs.slice(-4)) {
    pool.push({
      id: `SW_H_${s.index}`,
      label: 'Swing High',
      price: roundPx(s.price),
      family: 'swing'
    });
  }
  for (const s of swings.lows.slice(-4)) {
    pool.push({
      id: `SW_L_${s.index}`,
      label: 'Swing Low',
      price: roundPx(s.price),
      family: 'swing'
    });
  }

  const uniq = [];
  const seen = new Set();
  for (const lvl of pool.sort((a, b) => a.price - b.price)) {
    const bucket = Math.round(lvl.price);
    if (seen.has(bucket)) continue;
    seen.add(bucket);
    uniq.push(lvl);
  }

  const resistances = uniq
    .filter((l) => l.price > price * 1.0003)
    .sort((a, b) => a.price - b.price)
    .slice(0, 4);
  const supports = uniq
    .filter((l) => l.price < price * 0.9997)
    .sort((a, b) => b.price - a.price)
    .slice(0, 4);

  return { supports, resistances, all: uniq };
}

function dayRangePosition(price, dayHigh, dayLow) {
  if (!price || !dayHigh || !dayLow || dayHigh <= dayLow) return null;
  const pos = ((price - dayLow) / (dayHigh - dayLow)) * 100;
  return roundPx(Math.max(0, Math.min(100, pos)), 1);
}

function scoreToBias(score) {
  if (score >= 22) return 'UP';
  if (score <= -22) return 'DOWN';
  return 'RANGE';
}

function confidenceFromScore(score) {
  const abs = Math.abs(score);
  return Math.max(35, Math.min(92, Math.round(48 + abs * 0.9)));
}

/**
 * Analyze one index / symbol.
 */
export function analyzeInstrument({
  symbol,
  name,
  candles = [],
  currentPrice = 0,
  dayOpen = 0,
  high = 0,
  low = 0,
  change = 0,
  smcData = null
} = {}) {
  const price = Number(currentPrice) || (candles.length ? candles[candles.length - 1].close : 0);
  const daily = buildDailyBars(candles);
  const priorDay = daily.length >= 2 ? daily[daily.length - 2] : daily[daily.length - 1] || null;
  const today = daily.length ? daily[daily.length - 1] : null;
  const pivots = classicPivots(priorDay);
  const camarilla = camarillaPivots(priorDay);
  const swings = findSwings(candles, 3);
  const structure = structureBias(candles);
  const momentum = momentumScore(candles, price);

  let score = structure.score + momentum.score;
  // Day % change weight
  if (Number(change) >= 0.45) score += 10;
  else if (Number(change) <= -0.45) score -= 10;
  else if (Number(change) >= 0.15) score += 4;
  else if (Number(change) <= -0.15) score -= 4;

  // Price vs classic pivot
  if (pivots?.pp) {
    if (price > pivots.pp) score += 8;
    else if (price < pivots.pp) score -= 8;
  }

  // SMC order block nudge
  if (smcData?.activeBullishOB) score += 10;
  if (smcData?.activeBearishOB) score -= 10;
  if (smcData?.recentBOS?.type === 'BULLISH') score += 6;
  if (smcData?.recentBOS?.type === 'BEARISH') score -= 6;

  const bias = scoreToBias(score);
  const confidence = confidenceFromScore(score);
  const levels = nearestLevels(price, pivots, camarilla, swings);
  const dayHigh = high || today?.high || price;
  const dayLow = low || today?.low || price;
  const rangePos = dayRangePosition(price, dayHigh, dayLow);

  const breakUp = levels.resistances[0]?.price || pivots?.r1 || null;
  const breakDown = levels.supports[0]?.price || pivots?.s1 || null;
  const upTarget = levels.resistances[1]?.price || pivots?.r2 || null;
  const downTarget = levels.supports[1]?.price || pivots?.s2 || null;
  const invalidateUp = breakDown;
  const invalidateDown = breakUp;

  const scenarios = {
    upside: {
      trigger: breakUp,
      triggerLabel: 'Break & hold above',
      target: upTarget,
      invalidation: invalidateUp,
      summary:
        breakUp != null
          ? `Upside active if price holds above ${breakUp}${upTarget ? ` — next magnet ${upTarget}` : ''}.`
          : 'Waiting for resistance reference.'
    },
    downside: {
      trigger: breakDown,
      triggerLabel: 'Break & hold below',
      target: downTarget,
      invalidation: invalidateDown,
      summary:
        breakDown != null
          ? `Downside active if price loses ${breakDown}${downTarget ? ` — next magnet ${downTarget}` : ''}.`
          : 'Waiting for support reference.'
    },
    range: {
      ceiling: breakUp,
      floor: breakDown,
      summary:
        breakUp != null && breakDown != null
          ? `Range play between ${breakDown} and ${breakUp} until a clean break.`
          : 'Range boundaries still forming.'
    }
  };

  const headline =
    bias === 'UP'
      ? `${name || symbol} bias UP — buyers controlling above pivot`
      : bias === 'DOWN'
        ? `${name || symbol} bias DOWN — sellers pressing below pivot`
        : `${name || symbol} in RANGE — wait for break of fixed levels`;

  return {
    symbol,
    name: name || symbol,
    price: roundPx(price),
    change: roundPx(Number(change) || 0, 2),
    dayOpen: roundPx(dayOpen || today?.open || price),
    dayHigh: roundPx(dayHigh),
    dayLow: roundPx(dayLow),
    rangePositionPct: rangePos,
    candleCount: candles.length,
    bias,
    score: roundPx(score, 1),
    confidence,
    headline,
    structure,
    momentum,
    pivots,
    camarilla,
    supports: levels.supports,
    resistances: levels.resistances,
    fixedPoints: [
      pivots && { id: 'PP', label: 'Pivot (PP)', price: pivots.pp, role: 'balance' },
      pivots && { id: 'R1', label: 'Resistance R1', price: pivots.r1, role: 'resistance' },
      pivots && { id: 'R2', label: 'Resistance R2', price: pivots.r2, role: 'resistance' },
      pivots && { id: 'S1', label: 'Support S1', price: pivots.s1, role: 'support' },
      pivots && { id: 'S2', label: 'Support S2', price: pivots.s2, role: 'support' },
      levels.resistances[0] && {
        id: 'NEAR_R',
        label: 'Nearest resistance',
        price: levels.resistances[0].price,
        role: 'resistance'
      },
      levels.supports[0] && {
        id: 'NEAR_S',
        label: 'Nearest support',
        price: levels.supports[0].price,
        role: 'support'
      }
    ].filter(Boolean),
    scenarios,
    smc: smcData
      ? {
          bullishOB: smcData.activeBullishOB
            ? {
                top: smcData.activeBullishOB.top,
                bottom: smcData.activeBullishOB.bottom
              }
            : null,
          bearishOB: smcData.activeBearishOB
            ? {
                top: smcData.activeBearishOB.top,
                bottom: smcData.activeBearishOB.bottom
              }
            : null,
          bos: smcData.recentBOS || null
        }
      : null,
    priorSession: priorDay
      ? {
          date: priorDay.date,
          open: roundPx(priorDay.open),
          high: roundPx(priorDay.high),
          low: roundPx(priorDay.low),
          close: roundPx(priorDay.close)
        }
      : null
  };
}

/**
 * Slim F&O card for searchable universe UI (no heavy scenario payloads).
 */
export function compactFnoCard(analysis, meta = {}) {
  if (!analysis?.symbol) return null;
  const absScore = Math.abs(Number(analysis.score) || 0);
  const confidence = Number(analysis.confidence) || 0;
  const change = Number(analysis.change) || 0;
  const hasBullOb = Boolean(analysis.smc?.bullishOB);
  const hasBearOb = Boolean(analysis.smc?.bearishOB);
  const bosType = analysis.smc?.bos?.type || null;

  const reasons = [];
  if (analysis.bias === 'UP' && absScore >= 22) reasons.push('Strong UP bias');
  if (analysis.bias === 'DOWN' && absScore >= 22) reasons.push('Strong DOWN bias');
  if (analysis.bias === 'RANGE') reasons.push('Range — wait for break');
  if (hasBullOb) reasons.push('Bullish order block');
  if (hasBearOb) reasons.push('Bearish order block');
  if (bosType === 'BULLISH') reasons.push('Bullish BOS');
  if (bosType === 'BEARISH') reasons.push('Bearish BOS');
  if (Math.abs(change) >= 1.2) reasons.push(change > 0 ? 'High momentum up' : 'High momentum down');
  if (analysis.rangePositionPct != null && analysis.rangePositionPct >= 85) {
    reasons.push('Near day high');
  }
  if (analysis.rangePositionPct != null && analysis.rangePositionPct <= 15) {
    reasons.push('Near day low');
  }
  if (!reasons.length) reasons.push(analysis.headline || 'Monitor levels');

  // Priority: directional conviction + structure confluence
  let priorityScore = absScore * 1.2 + confidence * 0.35 + Math.min(25, Math.abs(change) * 8);
  if (hasBullOb || hasBearOb) priorityScore += 14;
  if (bosType) priorityScore += 8;
  if (analysis.bias === 'RANGE') priorityScore *= 0.55;

  const priority =
    priorityScore >= 70 ? 'HIGH' : priorityScore >= 45 ? 'MEDIUM' : 'LOW';

  const action =
    analysis.bias === 'UP'
      ? 'Long setups near support / after R break'
      : analysis.bias === 'DOWN'
        ? 'Short setups near resistance / after S break'
        : 'Wait — fade extremes until S/R break';

  return {
    symbol: analysis.symbol,
    name: analysis.name || analysis.symbol,
    sector: meta.sector || 'F&O',
    price: analysis.price,
    change: analysis.change,
    bias: analysis.bias,
    score: analysis.score,
    confidence,
    priority,
    priorityScore: roundPx(priorityScore, 1),
    headline: analysis.headline,
    action,
    watchReasons: reasons.slice(0, 3),
    nearestResistance: analysis.resistances?.[0]?.price ?? analysis.pivots?.r1 ?? null,
    nearestSupport: analysis.supports?.[0]?.price ?? analysis.pivots?.s1 ?? null,
    pivot: analysis.pivots?.pp ?? null,
    rangePositionPct: analysis.rangePositionPct,
    rsi: analysis.momentum?.rsi ?? null,
    volume: meta.volume || 0,
    isIndex: meta.sector === 'Indices'
  };
}

/**
 * Rank F&O cards into searchable universe + "kispe dekhna hai" watch picks.
 */
export function buildFnoUniverseSection(cards = []) {
  const all = (cards || []).filter(Boolean);
  const stocks = all.filter((c) => !c.isIndex);
  const sorted = [...stocks].sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

  const watchNow = sorted.filter((c) => c.priority === 'HIGH' || c.priority === 'MEDIUM').slice(0, 12);
  const upBias = stocks.filter((c) => c.bias === 'UP').sort((a, b) => (b.score || 0) - (a.score || 0));
  const downBias = stocks
    .filter((c) => c.bias === 'DOWN')
    .sort((a, b) => (a.score || 0) - (b.score || 0));
  const sectors = [...new Set(stocks.map((c) => c.sector).filter(Boolean))].sort();

  return {
    total: stocks.length,
    upCount: upBias.length,
    downCount: downBias.length,
    rangeCount: stocks.filter((c) => c.bias === 'RANGE').length,
    highPriorityCount: stocks.filter((c) => c.priority === 'HIGH').length,
    sectors,
    watchNow,
    topUp: upBias.slice(0, 8),
    topDown: downBias.slice(0, 8),
    all: sorted
  };
}

/**
 * Analyze every in-memory F&O stock into compact cards (uses live candles/SMC when present).
 */
export function analyzeFnoUniverseFromStocks(stocksMap) {
  const cards = [];
  for (const stock of stocksMap?.values?.() || []) {
    if (!stock?.symbol) continue;
    const analysis = analyzeInstrument({
      symbol: stock.symbol,
      name: stock.name,
      candles: stock.candles || [],
      currentPrice: stock.currentPrice,
      dayOpen: stock.dayOpen,
      high: stock.high,
      low: stock.low,
      change: stock.change,
      smcData: stock.smcData
    });
    const card = compactFnoCard(analysis, {
      sector: stock.sector,
      volume: stock.volume
    });
    if (card) cards.push(card);
  }
  return buildFnoUniverseSection(cards);
}

/**
 * Combine Nifty + BankNifty + market breadth into one report.
 */
export function buildMarketAnalysisReport({ nifty, bankNifty, breadth = null, fnoUniverse = null } = {}) {
  const instruments = [nifty, bankNifty].filter(Boolean);
  const avgScore =
    instruments.length > 0
      ? instruments.reduce((acc, i) => acc + (Number(i.score) || 0), 0) / instruments.length
      : 0;

  let breadthScore = 0;
  let breadthNote = 'Breadth unavailable.';
  if (breadth) {
    const adv = Number(breadth.advancing) || 0;
    const dec = Number(breadth.declining) || 0;
    const ratio = dec > 0 ? adv / dec : adv > 0 ? 2 : 1;
    if (ratio >= 1.35) {
      breadthScore = 14;
      breadthNote = `Breadth supportive — ${adv} advancing vs ${dec} declining.`;
    } else if (ratio <= 0.75) {
      breadthScore = -14;
      breadthNote = `Breadth weak — ${adv} advancing vs ${dec} declining.`;
    } else {
      breadthScore = 0;
      breadthNote = `Breadth mixed — ${adv} advancing vs ${dec} declining.`;
    }
    if ((breadth.bullishSetupsCount || 0) > (breadth.bearishSetupsCount || 0) + 3) breadthScore += 6;
    if ((breadth.bearishSetupsCount || 0) > (breadth.bullishSetupsCount || 0) + 3) breadthScore -= 6;
  }

  let smtScore = 0;
  let smtNote = null;
  if (nifty && bankNifty) {
    const nc = Number(nifty.change) || 0;
    const bc = Number(bankNifty.change) || 0;
    if (nc > 0.35 && bc < -0.1) {
      smtScore = -10;
      smtNote = 'Bearish SMT: Nifty up while BankNifty lags.';
    } else if (nc < -0.35 && bc > 0.1) {
      smtScore = 10;
      smtNote = 'Bullish SMT: BankNifty holding while Nifty dips.';
    } else if (nc >= 0 && bc >= 0) {
      smtScore = 6;
      smtNote = 'Index confluence: both Nifty & BankNifty green.';
    } else if (nc < 0 && bc < 0) {
      smtScore = -6;
      smtNote = 'Index confluence: both Nifty & BankNifty red.';
    } else {
      smtNote = 'Index moves mixed — treat as range until aligned.';
    }
  }

  const compositeScore = avgScore + breadthScore + smtScore;
  const marketBias = scoreToBias(compositeScore);
  const confidence = confidenceFromScore(compositeScore);

  const niftyUp = nifty?.scenarios?.upside;
  const niftyDown = nifty?.scenarios?.downside;

  const bullets = [];
  if (nifty) bullets.push(nifty.headline);
  if (bankNifty) bullets.push(bankNifty.headline);
  bullets.push(breadthNote);
  if (smtNote) bullets.push(smtNote);

  if (fnoUniverse?.total) {
    const topNames = (fnoUniverse.watchNow || []).slice(0, 4).map((c) => c.symbol);
    bullets.push(
      `F&O scan: ${fnoUniverse.upCount} UP · ${fnoUniverse.downCount} DOWN · ${fnoUniverse.rangeCount} RANGE` +
        (topNames.length ? ` — pehle dekho: ${topNames.join(', ')}` : '')
    );
  }

  if (marketBias === 'UP') {
    bullets.push(
      niftyUp?.trigger
        ? `Market upside plan: Nifty hold above ${niftyUp.trigger}${niftyUp.target ? `, target ${niftyUp.target}` : ''}.`
        : 'Market upside plan: wait for Nifty resistance break.'
    );
  } else if (marketBias === 'DOWN') {
    bullets.push(
      niftyDown?.trigger
        ? `Market downside plan: Nifty lose ${niftyDown.trigger}${niftyDown.target ? `, target ${niftyDown.target}` : ''}.`
        : 'Market downside plan: wait for Nifty support break.'
    );
  } else {
    bullets.push(
      nifty?.scenarios?.range?.summary ||
        'Market range plan: fade extremes until Nifty breaks fixed S/R.'
    );
  }

  const verdict =
    marketBias === 'UP'
      ? 'Overall bias: UP — prefer long setups near support / after resistance break.'
      : marketBias === 'DOWN'
        ? 'Overall bias: DOWN — prefer short setups near resistance / after support break.'
        : 'Overall bias: RANGE — wait for fixed level break before chasing.';

  return {
    generatedAt: Date.now(),
    marketBias,
    compositeScore: roundPx(compositeScore, 1),
    confidence,
    verdict,
    summaryBullets: bullets.filter(Boolean),
    breadth: breadth
      ? {
          advancing: breadth.advancing || 0,
          declining: breadth.declining || 0,
          neutral: breadth.neutral || 0,
          advanceDeclineRatio: breadth.advanceDeclineRatio || 0,
          bullishSetupsCount: breadth.bullishSetupsCount || 0,
          bearishSetupsCount: breadth.bearishSetupsCount || 0,
          note: breadthNote
        }
      : null,
    smt: smtNote,
    instruments: {
      nifty: nifty || null,
      bankNifty: bankNifty || null
    },
    fnoUniverse: fnoUniverse || null,
    playbook: {
      whenUp: niftyUp?.summary || null,
      whenDown: niftyDown?.summary || null,
      whenRange: nifty?.scenarios?.range?.summary || null,
      fixedWatch: [
        nifty?.pivots?.pp && { symbol: 'NIFTY', label: 'PP', price: nifty.pivots.pp },
        nifty?.pivots?.r1 && { symbol: 'NIFTY', label: 'R1', price: nifty.pivots.r1 },
        nifty?.pivots?.s1 && { symbol: 'NIFTY', label: 'S1', price: nifty.pivots.s1 },
        bankNifty?.pivots?.pp && { symbol: 'BANKNIFTY', label: 'PP', price: bankNifty.pivots.pp },
        bankNifty?.pivots?.r1 && { symbol: 'BANKNIFTY', label: 'R1', price: bankNifty.pivots.r1 },
        bankNifty?.pivots?.s1 && { symbol: 'BANKNIFTY', label: 'S1', price: bankNifty.pivots.s1 }
      ].filter(Boolean)
    },
    disclaimer:
      'Technical scenario report from live OHLC structure & pivots. Levels can fail — manage risk. Not investment advice.'
  };
}
