import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NormalizeEmail } from '../../common/transformers/normalize-email.transformer.js';

export class SignupDto {
  @ApiProperty({
    description: 'Login email. Trimmed and lowercased.',
    example: 'ali@myshop.com',
    maxLength: 254,
  })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({
    description: 'Stored only as an argon2id hash.',
    example: 'supersecret123',
    minLength: 8,
    maxLength: 128,
    format: 'password',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ example: 'Ali', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    description: 'Your organization or app. Becomes your tenant.',
    example: 'MyShop',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  tenantName: string;
}
