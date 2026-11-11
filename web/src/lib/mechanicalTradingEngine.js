/**
 * Universal / NIFTY Mechanical Trading System
 * Port of Pine Script MTF trend + two-candle setup + breakout entry logic.
 */

const TF_SECONDS = {
  '1m': 60,
  '3m': 180,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '1d': 86400,
  '1w': 604800
};

const IST_TZ = 'Asia/Kolkata';

export const MECHANICAL_PRESETS = {
  nifty: {
    id: 'nifty',
    label: 'NIFTY Classic',
    tfs: [
      { key: '15m', enabled: true },
      { key: '1h', enabled: true },
      { key: '1d', enabled: true },
      { key: '1w', enabled: true }
    ],
    requireAll: true,
    /** Classic script also required Daily+Weekly AND 1H+15m (same as requireAll with 4 TFs) */
    rr: 2,
    expiry: 5,
    oneTrade: true,
    exitOpposite: true,
    chartTfHint: '5m'
  },
  universal: {
    id: 'universal',
    label: 'Universal v1.1',
    tfs: [
      { key: '15m', enabled: true },
      { key: '1h', enabled: true },
      { key: '1d', enabled: true },
      { key: '1w', enabled: true }
    ],
    requireAll: true,
    rr: 2,
    expiry: 5,
    oneTrade: true,
    exitOpposite: true,
    chartTfHint: null
  }
};

function getIstParts(unixSec) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TZ,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date(unixSec * 1000));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const hour = Number(get('hour') === '24' ? 0 : get('hour'));
  const minute = Number(get('minute'));
  return {
    weekday: get('weekday'),
    ymd: `${get('year')}-${get('month')}-${get('day')}`,
    mins: hour * 60 + minute
  };
}

function candleTimeSec(c) {
  if (Number.isFinite(c._unix) && c._unix > 0) return c._unix;
  if (typeof c.time === 'number') return c.time;
  if (typeof c.time === 'string') {
    return Math.floor(new Date(`${c.time}T00:00:00+05:30`).getTime() / 1000);
  }
  return Number(c.time) || 0;
}

function htfBucketStart(unixSec, tfKey) {
  const parts = getIstParts(unixSec);
  if (tfKey === '1d') return parts.ymd;
  if (tfKey === '1w') {
    const d = new Date(`${parts.ymd}T12:00:00+05:30`);
    const wd = parts.weekday;
    const offset = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[wd] ?? 0;
    const monday = new Date(d.getTime() - offset * 86400000);
    const y = monday.toLocaleString('en-CA', { timeZone: IST_TZ, year: 'numeric' });
    const m = monday.toLocaleString('en-CA', { timeZone: IST_TZ, month: '2-digit' });
    const dayNum = monday.toLocaleString('en-CA', { timeZone: IST_TZ, day: '2-digit' });
    return `${y}-${m}-${dayNum}`;
  }
  const step = TF_SECONDS[tfKey] || 900;
  const dayStartUtc = Math.floor(new Date(`${parts.ymd}T00:00:00+05:30`).getTime() / 1000);
  const secsFromMidnight = unixSec - dayStartUtc;
  const bucket = Math.floor(secsFromMidnight / step) * step;
  return dayStartUtc + bucket;
}

/** Aggregate LTF candles into HTF OHLC bars (completed only when mapped with offset). */
export function aggregateToTimeframe(candles, tfKey) {
  const map = new Map();
  for (const c of candles) {
    const t = candleTimeSec(c);
    if (!t) continue;
    const key = htfBucketStart(t, tfKey);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        time: typeof key === 'string' ? key : key,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        _sort: typeof key === 'string' ? Math.floor(new Date(`${key}T00:00:00+05:30`).getTime() / 1000) : key
      });
    } else {
      prev.high = Math.max(prev.high, c.high);
      prev.low = Math.min(prev.low, c.low);
      prev.close = c.close;
    }
  }
  return [...map.values()].sort((a, b) => a._sort - b._sort);
}

/** Stateful HH/HL / LH/LL trend — persists until opposite reversal. */
export function computeTrendSeries(candles) {
  const trends = new Array(candles.length).fill(0);
  let trend = 0;
  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    const bull = cur.high > prev.high && cur.low > prev.low && cur.close > prev.high;
    const bear = cur.high < prev.high && cur.low < prev.low && cur.close < prev.low;
    if (bull) trend = 1;
    else if (bear) trend = -1;
    trends[i] = trend;
  }
  if (candles.length) trends[0] = trends[1] || 0;
  return trends;
}

/**
 * Map each chart bar to last *completed* HTF trend (Pine: f_trend()[1] + lookahead_on).
 */
function mapHtfTrendToChart(chartCandles, htfCandles, htfTrends) {
  const out = new Array(chartCandles.length).fill(0);
  if (!htfCandles.length) return out;

  let htfIdx = 0;
  for (let i = 0; i < chartCandles.length; i++) {
    const t = candleTimeSec(chartCandles[i]);
    while (htfIdx + 1 < htfCandles.length) {
      const nextSort = htfCandles[htfIdx + 1]._sort ?? candleTimeSec(htfCandles[htfIdx + 1]);
      if (nextSort <= t) htfIdx += 1;
      else break;
    }
    // Use previous completed HTF bar's trend (exclude forming bar when chart is inside it)
    const completedIdx = Math.max(0, htfIdx - 1);
    out[i] = htfTrends[completedIdx] ?? 0;
  }
  return out;
}

function statusLabel(v) {
  return v === 1 ? 'BULLISH' : v === -1 ? 'BEARISH' : 'NEUTRAL';
}

/**
 * Run mechanical system on chart candles.
 * @param {Array} candles - chart TF OHLC sorted ascending
 * @param {object} options
 */
export function runMechanicalSystem(candles, options = {}) {
  const preset = MECHANICAL_PRESETS[options.preset] || MECHANICAL_PRESETS.universal;
  const rr = options.rr ?? preset.rr;
  const expiry = options.expiry ?? preset.expiry;
  const oneTrade = options.oneTrade ?? preset.oneTrade;
  const exitOpposite = options.exitOpposite ?? preset.exitOpposite;
  const requireAll = options.requireAll ?? preset.requireAll;
  const enabledTfs = (options.tfs || preset.tfs).filter((t) => t.enabled);
  const mintick = options.mintick || 0.05;

  const empty = {
    direction: 0,
    dashboard: [],
    markers: [],
    events: [],
    activeTrade: null,
    candleColors: [],
    stats: { setups: 0, buys: 0, sells: 0, stops: 0, targets: 0, oppositeExits: 0 }
  };

  if (!candles || candles.length < 5) return empty;

  // Nifty Classic script only fired setups/entries on 5m charts
  if (preset.id === 'nifty' && options.chartTimeframe && options.chartTimeframe !== '5m') {
    return {
      ...empty,
      dashboard: enabledTfs.map((tf) => ({ tf: tf.key, trend: 0, label: 'USE 5m' })),
      warning: 'Nifty Classic logic runs on 5-minute chart only. Switch TF to 5m or use Universal.'
    };
  }

  const chartTrend = computeTrendSeries(candles);

  // HTF trends — skip sparse HTFs from the hard filter so BUY/SELL can still fire
  const htfSeries = {};
  const dashboard = [];
  const activeFilterTfs = [];
  for (const tf of enabledTfs) {
    const agg = aggregateToTimeframe(candles, tf.key);
    const trends = computeTrendSeries(agg);
    const mapped = mapHtfTrendToChart(candles, agg, trends);
    htfSeries[tf.key] = mapped;
    const last = trends[trends.length - 1] || 0;
    const usable = agg.length >= 5;
    if (usable) activeFilterTfs.push(tf);
    dashboard.push({
      tf: tf.key,
      trend: last,
      label: usable ? statusLabel(last) : 'LOW DATA',
      usable
    });
  }
  const filterTfs = activeFilterTfs.length ? activeFilterTfs : enabledTfs;

  const markers = [];
  const events = [];
  const candleColors = new Array(candles.length).fill(null);
  const stats = { setups: 0, buys: 0, sells: 0, stops: 0, targets: 0, oppositeExits: 0 };

  let pendingDir = 0;
  let pendingEntry = NaN;
  let pendingSL = NaN;
  let pendingBar = -1;

  let inTrade = false;
  let tradeDir = 0;
  let activeEntry = NaN;
  let activeSL = NaN;
  let activeTarget = NaN;
  let activeTrade = null;

  let lastDirection = 0;

  for (let i = 2; i < candles.length; i++) {
    const cur = candles[i];
    const p1 = candles[i - 1];
    const p2 = candles[i - 2];
    const time = cur.time;

    // MTF filter — only count decided (non-neutral) HTFs so BUY/SELL still show
    let bullCount = 0;
    let bearCount = 0;
    let decidedCount = 0;
    for (const tf of filterTfs) {
      const v = htfSeries[tf.key]?.[i] ?? 0;
      if (v === 1) {
        bullCount += 1;
        decidedCount += 1;
      } else if (v === -1) {
        bearCount += 1;
        decidedCount += 1;
      }
    }
    const enabledCount = filterTfs.length;
    let bullAllowed = false;
    let bearAllowed = false;
    if (requireAll) {
      // All decided HTFs bullish/bearish; neutrals ignored so signals aren't blocked
      bullAllowed = decidedCount > 0 && bullCount === decidedCount && bearCount === 0;
      bearAllowed = decidedCount > 0 && bearCount === decidedCount && bullCount === 0;
      // If nothing decided yet, fall back to chart trend so entries still appear
      if (decidedCount === 0) {
        bullAllowed = chartTrend[i] === 1;
        bearAllowed = chartTrend[i] === -1;
      }
    } else {
      bullAllowed = enabledCount > 0 && bullCount > bearCount;
      bearAllowed = enabledCount > 0 && bearCount > bullCount;
    }
    const direction = bullAllowed ? 1 : bearAllowed ? -1 : 0;
    lastDirection = direction;

    const bullReversal = cur.high > p1.high && cur.low > p1.low && cur.close > p1.high;
    const bearReversal = cur.high < p1.high && cur.low < p1.low && cur.close < p1.low;

    const bullC1 = p1.high > p2.high && p1.low > p2.low;
    const bullC2 = cur.high > p1.high && cur.low > p1.low && cur.close > p1.high;
    const bullSetup = bullC1 && bullC2;

    const bearC1 = p1.high < p2.high && p1.low < p2.low;
    const bearC2 = cur.high < p1.high && cur.low < p1.low && cur.close < p1.low;
    const bearSetup = bearC1 && bearC2;

    let buyEvent = false;
    let sellEvent = false;
    let stopEvent = false;
    let targetEvent = false;
    let oppositeEvent = false;
    let setupEvent = false;

    // Manage open trade
    if (inTrade) {
      const hitSL = tradeDir === 1 ? cur.low <= activeSL : cur.high >= activeSL;
      const hitTarget = tradeDir === 1 ? cur.high >= activeTarget : cur.low <= activeTarget;
      const opposite = exitOpposite && (tradeDir === 1 ? bearReversal : bullReversal);

      if (hitSL) {
        stopEvent = true;
        stats.stops += 1;
        const fill =
          tradeDir === 1 && cur.open < activeSL
            ? cur.open
            : tradeDir === -1 && cur.open > activeSL
              ? cur.open
              : activeSL;
        markers.push({
          time,
          position: tradeDir === 1 ? 'aboveBar' : 'belowBar',
          color: '#ef4444',
          shape: 'arrowDown',
          text: 'SL',
          size: 'large'
        });
        events.push({ type: 'STOP', time, price: fill, dir: tradeDir, bar: i });
        inTrade = false;
        tradeDir = 0;
        activeTrade = null;
      } else if (hitTarget) {
        targetEvent = true;
        stats.targets += 1;
        markers.push({
          time,
          position: 'aboveBar',
          color: '#22c55e',
          shape: 'arrowUp',
          text: 'TP',
          size: 'large'
        });
        events.push({ type: 'TARGET', time, price: activeTarget, dir: tradeDir, bar: i });
        inTrade = false;
        tradeDir = 0;
        activeTrade = null;
      } else if (opposite) {
        oppositeEvent = true;
        stats.oppositeExits += 1;
        markers.push({
          time,
          position: 'aboveBar',
          color: '#f97316',
          shape: 'circle',
          text: 'EXIT',
          size: 'normal'
        });
        events.push({ type: 'OPPOSITE', time, price: cur.close, dir: tradeDir, bar: i });
        inTrade = false;
        tradeDir = 0;
        activeTrade = null;
      }
    }

    // New setup
    const canSetup = (!inTrade || !oneTrade) && pendingDir === 0;
    if (canSetup) {
      if (bullSetup && bullAllowed) {
        pendingDir = 1;
        pendingEntry = cur.high;
        pendingSL = cur.low;
        pendingBar = i;
        setupEvent = true;
        stats.setups += 1;
        markers.push({
          time,
          position: 'belowBar',
          color: '#22d3ee',
          shape: 'circle',
          text: 'SETUP▲',
          size: 'small'
        });
        events.push({ type: 'SETUP', time, price: cur.low, dir: 1, bar: i, entry: pendingEntry, sl: pendingSL });
      } else if (bearSetup && bearAllowed) {
        pendingDir = -1;
        pendingEntry = cur.low;
        pendingSL = cur.high;
        pendingBar = i;
        setupEvent = true;
        stats.setups += 1;
        markers.push({
          time,
          position: 'aboveBar',
          color: '#f43f5e',
          shape: 'circle',
          text: 'SETUP▼',
          size: 'small'
        });
        events.push({
          type: 'SETUP',
          time,
          price: cur.high,
          dir: -1,
          bar: i,
          entry: pendingEntry,
          sl: pendingSL
        });
      }
    }

    // Invalidate / expire pending (only after setup bar)
    if (pendingDir !== 0 && i > pendingBar) {
      const expired = i - pendingBar > expiry;
      const invalid = pendingDir === 1 ? cur.close <= pendingSL : cur.close >= pendingSL;
      const trendLost = pendingDir === 1 ? !bullAllowed : !bearAllowed;
      if (expired || invalid || trendLost) {
        pendingDir = 0;
        pendingEntry = NaN;
        pendingSL = NaN;
        pendingBar = -1;
      }
    }

    // Breakout entry — only candles AFTER setup
    if (pendingDir !== 0 && i > pendingBar && (!inTrade || !oneTrade)) {
      const breakout = pendingDir === 1 ? cur.high >= pendingEntry : cur.low <= pendingEntry;
      if (breakout) {
        const fillPrice =
          pendingDir === 1 ? Math.max(cur.open, pendingEntry) : Math.min(cur.open, pendingEntry);
        const risk = pendingDir === 1 ? fillPrice - pendingSL : pendingSL - fillPrice;
        if (risk > mintick) {
          inTrade = true;
          tradeDir = pendingDir;
          activeEntry = fillPrice;
          activeSL = pendingSL;
          activeTarget = pendingDir === 1 ? fillPrice + risk * rr : fillPrice - risk * rr;
          buyEvent = pendingDir === 1;
          sellEvent = pendingDir === -1;
          if (buyEvent) stats.buys += 1;
          if (sellEvent) stats.sells += 1;

          markers.push({
            time,
            position: pendingDir === 1 ? 'belowBar' : 'aboveBar',
            color: pendingDir === 1 ? '#84cc16' : '#ef4444',
            shape: pendingDir === 1 ? 'arrowUp' : 'arrowDown',
            text: pendingDir === 1 ? 'BUY' : 'SELL',
            size: 'large'
          });
          events.push({
            type: pendingDir === 1 ? 'BUY' : 'SELL',
            time,
            price: fillPrice,
            dir: pendingDir,
            bar: i,
            entry: activeEntry,
            sl: activeSL,
            target: activeTarget
          });
          activeTrade = {
            dir: tradeDir,
            entry: activeEntry,
            sl: activeSL,
            target: activeTarget,
            entryTime: time,
            entryBar: i
          };
        }
        pendingDir = 0;
        pendingEntry = NaN;
        pendingSL = NaN;
        pendingBar = -1;
      }
    }

    // Candle highlight priority
    if (buyEvent || sellEvent) candleColors[i] = 'entry';
    else if (stopEvent || targetEvent || oppositeEvent) candleColors[i] = 'exit';
    else if (setupEvent) candleColors[i] = 'setup';
    else if (chartTrend[i] === 1) candleColors[i] = 'bull';
    else if (chartTrend[i] === -1) candleColors[i] = 'bear';
  }

  // Refresh dashboard with last bar HTF values
  const lastI = candles.length - 1;
  const liveDash = enabledTfs.map((tf) => {
    const v = htfSeries[tf.key]?.[lastI] ?? 0;
    return { tf: tf.key, trend: v, label: statusLabel(v) };
  });

  return {
    direction: lastDirection,
    dashboard: liveDash.length ? liveDash : dashboard,
    markers,
    events,
    activeTrade,
    candleColors,
    chartTrend: chartTrend[lastI] || 0,
    stats,
    pending: pendingDir
      ? { dir: pendingDir, entry: pendingEntry, sl: pendingSL, bar: pendingBar }
      : null
  };
}

export function applyCandleHighlightColors(formattedCandles, candleColors) {
  const colorMap = {
    entry: { color: '#3b82f6', wick: '#3b82f6', border: '#3b82f6' },
    exit: { color: '#f97316', wick: '#f97316', border: '#f97316' },
    setup: { color: '#22d3ee', wick: '#22d3ee', border: '#22d3ee' },
    bull: { color: '#84cc16', wick: '#84cc16', border: '#65a30d' },
    bear: { color: '#ef4444', wick: '#ef4444', border: '#dc2626' }
  };

  return formattedCandles.map((c, i) => {
    const key = candleColors[i];
    if (!key || !colorMap[key]) return c;
    const m = colorMap[key];
    return {
      ...c,
      color: m.color,
      wickColor: m.wick,
      borderColor: m.border
    };
  });
}
