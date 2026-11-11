/**
 * Smart Money Concepts (SMC) & Order Block (OB) Calculation Engine
 * Analyzes OHLCV candlestick data to identify:
 * 1. Swing Highs & Swing Lows
 * 2. Break of Structure (BOS) & Change of Character (CHoCH)
 * 3. Bullish & Bearish Order Blocks (Institutional Footprints)
 * 4. Fair Value Gaps (FVG / Imbalances)
 * 5. Liquidity Pools (Buy-side & Sell-side Liquidity)
 * 6. Setup Quality Ranking Score (0 - 100)
 */

export class SMCEngine {
  constructor(options = {}) {
    this.swingLength = options.swingLength || 5; // Lookback for swing pivots
    this.obLookback = options.obLookback || 30; // Max candles to trace back for Order Block
  }

  /**
   * Analyze candles and extract all institutional market structures
   * @param {Array} candles - Array of { time, open, high, low, close, volume } sorted chronologically
   * @param {String} symbol - Stock symbol (e.g. RELIANCE, HDFCBANK)
   * @param {String} timeframe - e.g. '1m', '5m', '15m'
   */
  analyze(candles, symbol = '', timeframe = '5m') {
    if (!candles || candles.length < 15) {
      return null;
    }

    const len = candles.length;
    const currentPrice = candles[len - 1].close;

    // 1. Identify Swings
    const { swingHighs, swingLows } = this.findSwings(candles);

    // 2. Identify Order Blocks
    const orderBlocks = this.findOrderBlocks(candles, swingHighs, swingLows);

    // 3. Identify Fair Value Gaps (FVG)
    const fvgs = this.findFVGs(candles);

    // 4. Identify Liquidity Levels (Buy-side & Sell-side)
    const liquidity = this.findLiquidity(candles, swingHighs, swingLows);

    // Filter active (unmitigated or fresh) Order Blocks
    const activeBullishOB = orderBlocks
      .filter((ob) => ob.type === 'BULLISH' && !ob.mitigated && currentPrice >= ob.bottom * 0.98)
      .sort((a, b) => b.score - a.score)[0] || null;

    const activeBearishOB = orderBlocks
      .filter((ob) => ob.type === 'BEARISH' && !ob.mitigated && currentPrice <= ob.top * 1.02)
      .sort((a, b) => b.score - a.score)[0] || null;

    // Check recent Break of Structure
    const recentBOS = this.detectBOS(candles, swingHighs, swingLows);

    return {
      symbol,
      timeframe,
      currentPrice,
      activeBullishOB,
      activeBearishOB,
      allOrderBlocks: orderBlocks.slice(-8), // Keep recent
      fvgs: fvgs.slice(-4),
      liquidity,
      recentBOS,
      timestamp: candles[len - 1].time
    };
  }

  /**
   * Find Swing Highs & Lows (Fractal pivots)
   */
  findSwings(candles) {
    const swingHighs = [];
    const swingLows = [];
    const k = Math.min(this.swingLength, 3);

    for (let i = k; i < candles.length - k; i++) {
      const current = candles[i];
      let isHigh = true;
      let isLow = true;

      for (let j = 1; j <= k; j++) {
        if (candles[i - j].high >= current.high || candles[i + j].high >= current.high) {
          isHigh = false;
        }
        if (candles[i - j].low <= current.low || candles[i + j].low <= current.low) {
          isLow = false;
        }
      }

      if (isHigh) {
        swingHighs.push({
          index: i,
          time: current.time,
          price: current.high,
          candle: current
        });
      }
      if (isLow) {
        swingLows.push({
          index: i,
          time: current.time,
          price: current.low,
          candle: current
        });
      }
    }

    return { swingHighs, swingLows };
  }

  /**
   * Find Bullish & Bearish Order Blocks
   * Bullish OB: Last down candle (red) before a violent breakout upwards that breaks swing structure.
   * Bearish OB: Last up candle (green) before a violent drop downwards that breaks swing structure.
   */
  findOrderBlocks(candles, swingHighs, swingLows) {
    const orderBlocks = [];
    const len = candles.length;

    for (let i = 2; i < len - 1; i++) {
      const candle = candles[i];
      const isBearishCandle = candle.close < candle.open;
      const isBullishCandle = candle.close > candle.open;

      // 1. Check for Bullish Order Block setup:
      // Red candle followed by strong green displacement candle(s)
      if (isBearishCandle) {
        const next1 = candles[i + 1];
        const next2 = i + 2 < len ? candles[i + 2] : null;

        // Strong upward move
        const strongUp = next1 && (next1.close - next1.open) > (candle.open - candle.low) * 1.2 && next1.close > candle.high;

        if (strongUp) {
          // Check if this move broke any recent swing high
          const brokeStructure = swingHighs.some(
            sh => sh.index < i && next1.close > sh.price && candle.high <= sh.price
          ) || (next2 && next2.close > candle.high * 1.004);

          // Calculate displacement strength & volume surge
          const avgVol = (candles[i - 1]?.volume || candle.volume) + candle.volume;
          const volRatio = next1.volume ? (next1.volume / (avgVol / 2 || 1)) : 1.5;

          // Check mitigation (did price subsequently close below the OB bottom?)
          let mitigated = false;
          let testCount = 0;
          for (let m = i + 2; m < len; m++) {
            if (candles[m].low <= candle.high && candles[m].low >= candle.low) {
              testCount++;
            }
            if (candles[m].close < candle.low) {
              mitigated = true;
              break;
            }
          }

          // Setup score calculation (0 - 100)
          let score = 60;
          if (brokeStructure) score += 15;
          if (volRatio > 1.3) score += 15;
          if (testCount === 0) score += 10; // Fresh, untouched zone

          orderBlocks.push({
            id: `ob-bull-${i}-${candle.time}`,
            type: 'BULLISH',
            top: candle.high,
            bottom: candle.low,
            open: candle.open,
            close: candle.close,
            time: candle.time,
            mitigated,
            testCount,
            score: Math.min(score, 99),
            volumeRatio: parseFloat(volRatio.toFixed(2)),
            brokeStructure: Boolean(brokeStructure),
            color: '#10b981' // Emerald
          });
        }
      }

      // 2. Check for Bearish Order Block setup:
      // Green candle followed by strong red displacement drop
      if (isBullishCandle) {
        const next1 = candles[i + 1];
        const next2 = i + 2 < len ? candles[i + 2] : null;

        const strongDown = next1 && (next1.open - next1.close) > (candle.high - candle.open) * 1.2 && next1.close < candle.low;

        if (strongDown) {
          const brokeStructure = swingLows.some(
            sl => sl.index < i && next1.close < sl.price && candle.low >= sl.price
          ) || (next2 && next2.close < candle.low * 0.996);

          const avgVol = (candles[i - 1]?.volume || candle.volume) + candle.volume;
          const volRatio = next1.volume ? (next1.volume / (avgVol / 2 || 1)) : 1.5;

          let mitigated = false;
          let testCount = 0;
          for (let m = i + 2; m < len; m++) {
            if (candles[m].high >= candle.low && candles[m].high <= candle.high) {
              testCount++;
            }
            if (candles[m].close > candle.high) {
              mitigated = true;
              break;
            }
          }

          let score = 60;
          if (brokeStructure) score += 15;
          if (volRatio > 1.3) score += 15;
          if (testCount === 0) score += 10;

          orderBlocks.push({
            id: `ob-bear-${i}-${candle.time}`,
            type: 'BEARISH',
            top: candle.high,
            bottom: candle.low,
            open: candle.open,
            close: candle.close,
            time: candle.time,
            mitigated,
            testCount,
            score: Math.min(score, 99),
            volumeRatio: parseFloat(volRatio.toFixed(2)),
            brokeStructure: Boolean(brokeStructure),
            color: '#f43f5e' // Rose
          });
        }
      }
    }

    return orderBlocks;
  }

  /**
   * Identify Fair Value Gaps (FVG) / Imbalances
   * Bullish FVG: Low of candle 3 is higher than High of candle 1 (unfilled void)
   * Bearish FVG: High of candle 3 is lower than Low of candle 1
   */
  findFVGs(candles) {
    const fvgs = [];
    for (let i = 2; i < candles.length; i++) {
      const c1 = candles[i - 2];
      const c2 = candles[i - 1];
      const c3 = candles[i];

      // Bullish FVG
      if (c3.low > c1.high) {
        fvgs.push({
          type: 'BULLISH',
          top: c3.low,
          bottom: c1.high,
          mid: (c3.low + c1.high) / 2,
          time: c2.time
        });
      }
      // Bearish FVG
      else if (c3.high < c1.low) {
        fvgs.push({
          type: 'BEARISH',
          top: c1.low,
          bottom: c3.high,
          mid: (c1.low + c3.high) / 2,
          time: c2.time
        });
      }
    }
    return fvgs;
  }

  /**
   * Identify Key Liquidity Pools (Buy-side & Sell-side)
   */
  findLiquidity(candles, swingHighs, swingLows) {
    const recentCandles = candles.slice(-50);
    const highest = Math.max(...recentCandles.map(c => c.high));
    const lowest = Math.min(...recentCandles.map(c => c.low));

    return {
      buySide: {
        price: highest,
        label: 'Buy-Side Liquidity (BSL) / Equal Highs'
      },
      sellSide: {
        price: lowest,
        label: 'Sell-Side Liquidity (SSL) / Equal Lows'
      }
    };
  }

  /**
   * Detect recent Break of Structure (BOS)
   */
  detectBOS(candles, swingHighs, swingLows) {
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    const lastHigh = swingHighs[swingHighs.length - 1];
    const lastLow = swingLows[swingLows.length - 1];

    if (lastHigh && last.close > lastHigh.price && prev.close <= lastHigh.price) {
      return { type: 'BULLISH_BOS', price: lastHigh.price, time: last.time };
    }
    if (lastLow && last.close < lastLow.price && prev.close >= lastLow.price) {
      return { type: 'BEARISH_BOS', price: lastLow.price, time: last.time };
    }

    return null;
  }
}

export const smcEngine = new SMCEngine();
