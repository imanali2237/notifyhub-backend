import { classifySmtpError, type SmtpError } from './smtp-email.provider.js';

const err = (fields: Partial<SmtpError>): SmtpError =>
  Object.assign(new Error('smtp error'), fields);

describe('classifySmtpError', () => {
  it.each([
    [
      'server unreachable (no reply)',
      err({ code: 'ECONNECTION' }),
      'temporary',
    ],
    ['timeout', err({ code: 'ETIMEDOUT' }), 'temporary'],
    ['4xx "try later"', err({ responseCode: 421 }), 'temporary'],
    [
      'login failed (EAUTH)',
      err({ code: 'EAUTH', responseCode: 535 }),
      'provider',
    ],
    ['535 auth reply', err({ responseCode: 535 }), 'provider'],
    ['bad address format', err({ code: 'EENVELOPE' }), 'message'],
    [
      'mailbox does not exist (5.1.1)',
      err({ responseCode: 550, response: '550 5.1.1 User unknown' }),
      'message',
    ],
    [
      'Gmail daily quota used up (5.4.5)',
      err({
        responseCode: 550,
        response: '550 5.4.5 Daily sending quota exceeded',
      }),
      'provider',
    ],
    [
      'blocked by policy (5.7.1)',
      err({ responseCode: 554, response: '554 5.7.1 Relay access denied' }),
      'provider',
    ],
    ['550 without details', err({ responseCode: 550 }), 'message'],
    ['other 5xx without details', err({ responseCode: 554 }), 'provider'],
  ] as const)('%s → %s', (_label, error, expected) => {
    expect(classifySmtpError(error)).toBe(expected);
  });
});
