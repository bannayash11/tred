/** Keep in sync with backend `OTP_DIGITS` / cooldown in authRoutes.js */
export const OTP_DIGITS = 6;
export const OTP_RESEND_COOLDOWN_SEC = 30;

export function isCompleteOtp(value, length = OTP_DIGITS) {
  return new RegExp(`^\\d{${length}}$`).test(String(value || '').trim());
}
