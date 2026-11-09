import type { MailMessage } from '../../mail/mail.interfaces.js';
import { OTP_TTL_SECONDS } from '../../otp/otp.constants.js';

/** The email sent after signup with the 6-digit verification code. */
export function verificationEmail(to: string, code: string): MailMessage {
  const minutes = OTP_TTL_SECONDS / 60;
  return {
    to,
    subject: `${code} is your NotifyHub verification code`,
    text: `Your NotifyHub verification code is ${code}.\n\nIt expires in ${minutes} minutes. If you didn't sign up, ignore this email.`,
    html: `<p>Your NotifyHub verification code is:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p>
<p>It expires in ${minutes} minutes. If you didn't sign up, ignore this email.</p>`,
  };
}
