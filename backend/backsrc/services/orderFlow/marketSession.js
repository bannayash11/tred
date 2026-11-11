/** IST market-session helpers (mirrors order-flow-main/src/lib/marketSession.ts). */

const IST_OFFSET_MS = 330 * 60_000;
export const MARKET_OPEN_MINUTE = 9 * 60 + 15;
export const DERIVATIVES_CLOSE_MINUTE = 15 * 60 + 40;
export const CAS_EFFECTIVE_DATE = '2026-08-03';
const LEGACY_MARKET_CLOSE_MINUTE = 15 * 60 + 30;

const NSE_HOLIDAYS = new Set([
  '2025-02-26', '2025-03-14', '2025-03-31', '2025-04-10', '2025-04-14', '2025-04-18',
  '2025-05-01', '2025-08-15', '2025-08-27', '2025-10-02', '2025-10-21', '2025-10-22',
  '2025-11-05', '2025-12-25',
  '2026-01-15', '2026-01-26', '2026-03-03', '2026-03-26', '2026-03-31', '2026-04-03',
  '2026-04-14', '2026-05-01', '2026-05-28', '2026-06-26', '2026-09-14', '2026-10-02',
  '2026-10-20', '2026-11-10', '2026-11-24', '2026-12-25',
  '2027-01-26', '2027-03-08', '2027-03-22', '2027-04-14', '2027-04-16', '2027-04-20',
  '2027-08-15', '2027-09-05', '2027-10-02', '2027-10-18', '2027-10-29', '2027-12-25'
]);

export function marketParts(time) {
  const ms = typeof time === 'number' ? time : time.getTime();
  if (!Number.isFinite(ms)) throw new RangeError('Invalid time value');
  const ist = new Date(ms + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth() + 1;
  const day = ist.getUTCDate();
  const hour = ist.getUTCHours();
  const minute = ist.getUTCMinutes();
  return {
    year,
    month,
    day,
    weekday: ist.getUTCDay(),
    hour,
    minute,
    dateKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    minuteOfDay: hour * 60 + minute
  };
}

export function marketCloseMinuteFor(time) {
  return marketParts(time).dateKey >= CAS_EFFECTIVE_DATE
    ? DERIVATIVES_CLOSE_MINUTE
    : LEGACY_MARKET_CLOSE_MINUTE;
}

export function isTradingDay(time) {
  const parts = marketParts(time);
  return parts.weekday !== 0 && parts.weekday !== 6 && !NSE_HOLIDAYS.has(parts.dateKey);
}

export function isMarketSessionTime(time) {
  const parts = marketParts(time);
  const closeMinute = marketCloseMinuteFor(time);
  return (
    isTradingDay(time) &&
    parts.minuteOfDay >= MARKET_OPEN_MINUTE &&
    parts.minuteOfDay <= closeMinute
  );
}

export function getPreviousTradingDay(daysBack, fromDate = new Date()) {
  let currentMs = fromDate.getTime();
  let daysCounted = 0;
  let iterations = 0;
  while (daysCounted < daysBack && iterations < 100) {
    currentMs -= 86400_000;
    const parts = marketParts(currentMs);
    if (parts.weekday !== 0 && parts.weekday !== 6 && !NSE_HOLIDAYS.has(parts.dateKey)) {
      daysCounted++;
    }
    iterations++;
  }
  return new Date(currentMs);
}

export function isExpirySettled(expiry, time = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return false;
  const parts = marketParts(time);
  if (expiry < parts.dateKey) return true;
  if (expiry > parts.dateKey) return false;
  return parts.minuteOfDay > marketCloseMinuteFor(time);
}

export function filterLiveExpiries(expiries, time = Date.now()) {
  return Array.from(new Set(expiries))
    .filter((expiry) => /^\d{4}-\d{2}-\d{2}$/.test(expiry) && !isExpirySettled(expiry, time))
    .sort((a, b) => a.localeCompare(b));
}

const SESSION_DAY_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
let latestSessionMemo = null;

export function getLatestTradingSessionDate(fromDate = new Date()) {
  const minute = Math.floor(fromDate.getTime() / 60_000);
  if (latestSessionMemo && latestSessionMemo.minute === minute) return latestSessionMemo.date;
  const parts = marketParts(fromDate);
  const date =
    !isTradingDay(fromDate) || parts.minuteOfDay < MARKET_OPEN_MINUTE
      ? SESSION_DAY_FORMAT.format(getPreviousTradingDay(1, fromDate))
      : parts.dateKey;
  latestSessionMemo = { minute, date };
  return date;
}
