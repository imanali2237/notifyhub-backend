import { IsEmail } from 'class-validator';
import { NormalizeEmail } from '../../common/transformers/normalize-email.transformer.js';

export class ResendOtpDto {
  @NormalizeEmail()
  @IsEmail()
  email: string;
}
