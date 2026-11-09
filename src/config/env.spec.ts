import { validateEnv } from './env.js';

/** The required settings, with email turned off. */
const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  MONGO_URI: 'mongodb://localhost:27017/db',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  OTP_SECRET: 'x'.repeat(32),
  JWT_SECRET: 'y'.repeat(32),
};
const smtp = {
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_FROM: 'NotifyHub <no-reply@example.com>',
};
const brevo = { BREVO_API_KEY: 'key', BREVO_FROM: 'no-reply@example.com' };

describe('validateEnv — email providers', () => {
  it('no providers → email disabled (allowed)', () => {
    expect(validateEnv(base).EMAIL_PROVIDERS).toEqual([]);
    expect(
      validateEnv({ ...base, EMAIL_PROVIDERS: '' }).EMAIL_PROVIDERS,
    ).toEqual([]);
  });

  it('one provider', () => {
    const env = validateEnv({ ...base, ...smtp, EMAIL_PROVIDERS: 'smtp' });
    expect(env.EMAIL_PROVIDERS).toEqual(['smtp']);
    expect(env.SMTP_PORT).toBe(1025);
  });

  it('several providers keep their order (failover order)', () => {
    const env = validateEnv({
      ...base,
      ...smtp,
      ...brevo,
      EMAIL_PROVIDERS: ' Brevo , smtp ',
    });
    expect(env.EMAIL_PROVIDERS).toEqual(['brevo', 'smtp']);
  });

  it('a listed provider without its settings is rejected', () => {
    expect(() => validateEnv({ ...base, EMAIL_PROVIDERS: 'smtp' })).toThrow(
      /SMTP_HOST is required because EMAIL_PROVIDERS includes "smtp"/,
    );
    expect(() =>
      validateEnv({ ...base, ...smtp, EMAIL_PROVIDERS: 'smtp,brevo' }),
    ).toThrow(/BREVO_API_KEY is required/);
  });

  it('unknown or duplicated providers are rejected', () => {
    expect(() =>
      validateEnv({ ...base, ...smtp, EMAIL_PROVIDERS: 'smtp,sendgrid' }),
    ).toThrow(/EMAIL_PROVIDERS/);
    expect(() =>
      validateEnv({ ...base, ...smtp, EMAIL_PROVIDERS: 'smtp,smtp' }),
    ).toThrow(/listed more than once/);
  });

  it('a malformed sender address is rejected', () => {
    expect(() =>
      validateEnv({
        ...base,
        ...brevo,
        BREVO_FROM: 'not an email',
        EMAIL_PROVIDERS: 'brevo',
      }),
    ).toThrow(/BREVO_FROM must look like/);
  });

  it('email verification needs at least one email provider', () => {
    expect(() =>
      validateEnv({ ...base, EMAIL_VERIFICATION_REQUIRED: 'true' }),
    ).toThrow(
      /EMAIL_VERIFICATION_REQUIRED=true needs at least one email provider/,
    );
    expect(() =>
      validateEnv({
        ...base,
        ...smtp,
        EMAIL_PROVIDERS: 'smtp',
        EMAIL_VERIFICATION_REQUIRED: 'true',
      }),
    ).not.toThrow();
  });
});
