import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail } from '../../common/transformers/normalize-email.transformer.js';

export class LoginDto {
  @ApiProperty({ example: 'ali@myshop.com' })
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'supersecret123',
    format: 'password',
    maxLength: 128,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}
