import { ApiProperty } from '@nestjs/swagger';

/** An API key as listed. The full key is never included. */
export class ApiKeyResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: 'd279b170-eb60-4bc8-bd97-769fe03f079a',
  })
  id: string;

  @ApiProperty({ example: 'Production server' })
  name: string;

  @ApiProperty({ enum: ['test', 'live'], example: 'live' })
  environment: 'test' | 'live';

  @ApiProperty({
    description: 'First characters of the key, to tell keys apart',
    example: 'nh_live_PQPKEqWD',
  })
  prefix: string;

  @ApiProperty({
    type: Date,
    nullable: true,
    example: '2026-11-09T08:30:00.000Z',
  })
  lastUsedAt: Date | null;

  @ApiProperty({ type: Date, nullable: true, example: null })
  revokedAt: Date | null;

  @ApiProperty({ type: Date, example: '2026-11-09T08:28:35.017Z' })
  createdAt: Date;
}

export class CreatedApiKeyResponseDto extends ApiKeyResponseDto {
  @ApiProperty({
    description: 'The full key. Returned ONLY in this response — store it now.',
    example: 'nh_live_PQPKEqWDylmPxfyIpkIyodr8IFRt74w1',
  })
  key: string;

  @ApiProperty({
    example: 'Copy this key now. You will not be able to see it again.',
  })
  warning: string;
}

/** Which tenant an API key belongs to. */
export class ApiKeyContextResponseDto {
  @ApiProperty({ format: 'uuid' })
  tenantId: string;

  @ApiProperty({ example: 'MyShop' })
  tenantName: string;

  @ApiProperty({ format: 'uuid' })
  apiKeyId: string;

  @ApiProperty({ enum: ['test', 'live'], example: 'live' })
  environment: 'test' | 'live';
}
