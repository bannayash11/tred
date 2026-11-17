/**
 * Quick OTP email smoke test.
 *
 * Usage:
 *   node testEmail.js
 *   node testEmail.js you@example.com "Your Name" 123456
 */
import { sendOTP } from './backsrc/services/emailService.js';

const toEmail = process.argv[2] || process.env.TEST_EMAIL_TO || '';
const toName = process.argv[3] || 'Tester';
const otpCode = process.argv[4] || String(Math.floor(100000 + Math.random() * 900000));

async function main() {
  if (!toEmail) {
    console.error('Usage: node testEmail.js <toEmail> [toName] [otpCode]');
    console.error('Or set TEST_EMAIL_TO in .env');
    process.exit(1);
  }

  console.log(`Sending OTP ${otpCode} to ${toEmail}...`);
  const result = await sendOTP({ toEmail, toName, otpCode });
  console.log('OTP email sent successfully.');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('Failed to send OTP email:', err.message || err);
  process.exit(1);
});
