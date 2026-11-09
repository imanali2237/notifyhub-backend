/** What every email provider (SMTP, Brevo, Gmail...) receives. */
export interface EmailMessage {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}
