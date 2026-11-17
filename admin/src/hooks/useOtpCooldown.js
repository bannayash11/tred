import { useCallback, useEffect, useState } from 'react';
import { OTP_RESEND_COOLDOWN_SEC } from '../lib/otp';

export default function useOtpCooldown(initialSec = 0) {
  const [secondsLeft, setSecondsLeft] = useState(Math.max(0, Number(initialSec) || 0));

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setTimeout(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const start = useCallback((sec = OTP_RESEND_COOLDOWN_SEC) => {
    const n = Number(sec);
    setSecondsLeft(Number.isFinite(n) && n > 0 ? Math.ceil(n) : OTP_RESEND_COOLDOWN_SEC);
  }, []);

  const clear = useCallback(() => setSecondsLeft(0), []);

  return {
    secondsLeft,
    active: secondsLeft > 0,
    start,
    clear
  };
}