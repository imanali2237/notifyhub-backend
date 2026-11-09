import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto.js';

/**
 * Documents a route's error responses in one line:
 *   @ApiErrorResponses({ 400: 'Invalid body', 409: 'Email already registered' })
 */
export const ApiErrorResponses = (errors: Record<number, string>) =>
  applyDecorators(
    ...Object.entries(errors).map(([status, description]) =>
      ApiResponse({
        status: Number(status),
        description,
        type: ErrorResponseDto,
      }),
    ),
  );
