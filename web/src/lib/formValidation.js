/** Shared helpers for field-level form validation UX. */

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function positiveNumber(value, { allowZero = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  return allowZero ? n >= 0 : n > 0;
}

export function wholeNumberAtLeast(value, min = 1) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min;
}

export function firstError(errors) {
  const vals = Object.values(errors || {}).filter(Boolean);
  return vals[0] || '';
}

export function fieldBorderClass(hasError, ok = 'border-slate-800 focus:border-cyan-500') {
  return hasError ? 'border-rose-600 focus:border-rose-500' : ok;
}

export function validateTradeForm(form) {
  const errors = {};
  const symbol = String(form.symbol || '').trim().toUpperCase();
  if (!symbol || symbol.length < 1) {
    errors.symbol = 'Enter a valid stock symbol.';
  }

  const entry = Number(form.entryPrice);
  const sl = Number(form.stopLoss);
  const target = Number(form.targetPrice);
  const exit = Number(form.exitPrice);
  const qty = Number(form.quantity);
  const direction = String(form.direction || 'BUY').toUpperCase();
  const status = String(form.status || 'OPEN').toUpperCase();

  if (!positiveNumber(form.entryPrice)) {
    errors.entryPrice = 'Enter a valid entry price greater than 0.';
  }
  if (!positiveNumber(form.stopLoss)) {
    errors.stopLoss = 'Enter a valid stop loss greater than 0.';
  }
  if (!positiveNumber(form.targetPrice)) {
    errors.targetPrice = 'Enter a valid target price greater than 0.';
  }
  if (!wholeNumberAtLeast(form.quantity, 1)) {
    errors.quantity = 'Quantity must be a whole number of at least 1.';
  }

  if (!errors.entryPrice && !errors.stopLoss && !errors.targetPrice) {
    if (direction === 'BUY') {
      if (!(sl < entry)) errors.stopLoss = 'For a BUY, stop loss must be below entry.';
      if (!(target > entry)) errors.targetPrice = 'For a BUY, target must be above entry.';
    } else if (direction === 'SELL') {
      if (!(sl > entry)) errors.stopLoss = 'For a SELL, stop loss must be above entry.';
      if (!(target < entry)) errors.targetPrice = 'For a SELL, target must be below entry.';
    }
  }

  if (status !== 'OPEN' && !positiveNumber(form.exitPrice)) {
    errors.exitPrice = 'Exit price is required for closed trades.';
  }

  return { errors, values: { ...form, symbol, entryPrice: entry, stopLoss: sl, targetPrice: target, exitPrice: status === 'OPEN' ? '' : exit, quantity: qty } };
}
