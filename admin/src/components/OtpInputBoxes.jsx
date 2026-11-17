import React, { useEffect, useMemo, useRef } from 'react';
import { OTP_DIGITS } from '../lib/otp';

export default function OtpInputBoxes({
  value = '',
  onChange,
  length = OTP_DIGITS,
  disabled = false,
  autoFocus = true,
  hasError = false,
  id = 'otp',
  ariaLabel = 'One-time password'
}) {
  const inputsRef = useRef([]);
  const digits = useMemo(() => {
    const cleaned = String(value || '').replace(/\D/g, '').slice(0, length);
    return Array.from({ length }, (_, i) => cleaned[i] || '');
  }, [value, length]);

  useEffect(() => {
    if (!autoFocus || disabled) return;
    const firstEmpty = digits.findIndex((d) => !d);
    const idx = firstEmpty === -1 ? length - 1 : firstEmpty;
    inputsRef.current[idx]?.focus();
  }, [autoFocus, disabled, length]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = (nextDigits) => {
    onChange?.(nextDigits.join('').slice(0, length));
  };

  const focusAt = (index) => {
    const el = inputsRef.current[Math.max(0, Math.min(length - 1, index))];
    if (!el) return;
    el.focus();
    el.select?.();
  };

  const handleChange = (index, raw) => {
    const onlyDigits = String(raw || '').replace(/\D/g, '');
    if (!onlyDigits) {
      const next = [...digits];
      next[index] = '';
      emit(next);
      return;
    }

    if (onlyDigits.length > 1) {
      const next = [...digits];
      for (let i = 0; i < onlyDigits.length && index + i < length; i += 1) {
        next[index + i] = onlyDigits[i];
      }
      emit(next);
      focusAt(Math.min(length - 1, index + onlyDigits.length));
      return;
    }

    const next = [...digits];
    next[index] = onlyDigits;
    emit(next);
    if (index < length - 1) focusAt(index + 1);
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        emit(next);
      } else if (index > 0) {
        const next = [...digits];
        next[index - 1] = '';
        emit(next);
        focusAt(index - 1);
      }
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusAt(index - 1);
    }
    if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      focusAt(index + 1);
    }
  };

  const handlePaste = (index, e) => {
    const pasted = e.clipboardData?.getData('text') || '';
    const onlyDigits = pasted.replace(/\D/g, '');
    if (!onlyDigits) return;
    e.preventDefault();
    const next = [...digits];
    for (let i = 0; i < onlyDigits.length && index + i < length; i += 1) {
      next[index + i] = onlyDigits[i];
    }
    emit(next);
    focusAt(Math.min(length - 1, index + onlyDigits.length - 1));
  };

  return (
    <div role="group" aria-label={ariaLabel} className="flex w-full items-center justify-between gap-2">
      <input
        type="text"
        name={id}
        value={digits.join('')}
        readOnly
        tabIndex={-1}
        autoComplete="one-time-code"
        required
        className="sr-only"
        aria-hidden="true"
      />
      {digits.map((digit, index) => (
        <input
          key={`${id}-${index}`}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          value={digit}
          aria-label={`${ariaLabel} digit ${index + 1} of ${length}`}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={(e) => handlePaste(index, e)}
          onFocus={(e) => e.target.select()}
          className={[
            'admin-input h-11 w-full max-w-[2.75rem] flex-1 px-0 text-center text-lg font-semibold tracking-normal',
            hasError ? 'border-rose-500 focus:border-rose-400' : ''
          ]
            .filter(Boolean)
            .join(' ')}
        />
      ))}
    </div>
  );
}
