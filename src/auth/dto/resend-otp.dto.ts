import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { NormalizeEmail } from '../../common/transformers/normalize-email.transformer.js';

export class ResendOtpDto {
  @ApiProperty({ example: 'ali@myshop.com' })
  @NormalizeEmail()
  @IsEmail()
  email: string;
}
