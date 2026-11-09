import { IsEmail, Matches } from 'class-validator';
import { NormalizeEmail } from '../../common/transformers/normalize-email.transformer.js';

export class VerifyEmailDto {
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @Matches(/^\d{6}$/, { message: 'otp must be a 6-digit code' })
  otp: string;
}
