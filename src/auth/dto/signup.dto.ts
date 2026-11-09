import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NormalizeEmail } from '../../common/transformers/normalize-email.transformer.js';

export class SignupDto {
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  /** The organization / app name — becomes the Tenant. */
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  tenantName: string;
}
