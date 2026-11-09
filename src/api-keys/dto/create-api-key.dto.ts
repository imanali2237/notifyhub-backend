import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { ApiKeyEnvironment } from '../../generated/prisma/client.js';

export class CreateApiKeyDto {
  @ApiProperty({
    description: 'A label so you can tell keys apart',
    example: 'Production server',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: '`live` → nh_live_… key, `test` → nh_test_… key',
    enum: ['test', 'live'],
    default: 'live',
  })
  @IsOptional()
  @IsIn(['test', 'live'])
  environment?: ApiKeyEnvironment;
}
