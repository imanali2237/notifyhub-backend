import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { ApiKeyEnvironment } from '../../generated/prisma/client.js';

export class CreateApiKeyDto {
  /** A label so you can tell keys apart, e.g. "Production server". */
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  /** "live" (default) → nh_live_..., "test" → nh_test_... */
  @IsOptional()
  @IsIn(['test', 'live'])
  environment?: ApiKeyEnvironment;
}
