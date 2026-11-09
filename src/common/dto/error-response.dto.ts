import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Shape of every error response (Nest's default exception format). */
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    description: 'One message, or a list of validation errors',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: ['email must be an email'],
  })
  message: string | string[];

  @ApiPropertyOptional({ example: 'Bad Request' })
  error?: string;
}
