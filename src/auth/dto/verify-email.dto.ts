import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, Matches } from 'class-validator';
import { NormalizeEmail } from '../../common/transformers/normalize-email.transformer.js';

export class VerifyEmailDto {
  @ApiProperty({ example: 'ali@myshop.com' })
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: '6-digit code from the verification email',
    example: '482913',
    pattern: '^\\d{6}$',
  })
  @Matches(/^\d{6}$/, { message: 'otp must be a 6-digit code' })
  otp: string;
}
