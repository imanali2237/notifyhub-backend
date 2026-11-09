import { Transform } from 'class-transformer';

/**
 * DTO decorator: trims and lowercases an email, so "Ali@X.com " and "ali@x.com"
 * are treated as the same account.
 *
 *   @NormalizeEmail()
 *   @IsEmail()
 *   email: string;
 */
export const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
