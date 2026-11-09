import type { MailMessage } from '../../mail/mail.interfaces.js';

/** The email sent after signup with the verification code. */
export function verificationEmail(
  to: string,
  code: string,
  ttlSeconds: number,
): MailMessage {
  const minutes = Math.round(ttlSeconds / 60);
  return {
    to,
    subject: `${code} is your NotifyHub verification code`,
    text: `Your NotifyHub verification code is ${code}.\n\nIt expires in ${minutes} minutes. If you didn't sign up, ignore this email.`,
    html: `<p>Your NotifyHub verification code is:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p>
<p>It expires in ${minutes} minutes. If you didn't sign up, ignore this email.</p>`,
  };
}
