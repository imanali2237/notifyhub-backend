import { ApiProperty } from '@nestjs/swagger';

class HealthServicesDto {
  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  postgres: 'up' | 'down';

  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  mongo: 'up' | 'down';

  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  redis: 'up' | 'down';
}

export class HealthResponseDto {
  @ApiProperty({ enum: ['ok', 'error'], example: 'ok' })
  status: 'ok' | 'error';

  @ApiProperty({ type: HealthServicesDto })
  services: HealthServicesDto;
}
