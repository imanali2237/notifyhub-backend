import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsMongoId,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import {
  INBOX_DEFAULT_PAGE_SIZE,
  INBOX_MAX_PAGE_SIZE,
} from '../inbox.constants.js';

export class ListInboxQuery {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: INBOX_MAX_PAGE_SIZE,
    default: INBOX_DEFAULT_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(INBOX_MAX_PAGE_SIZE)
  limit: number = INBOX_DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({
    description: '`nextCursor` from the previous page, to load older messages',
    example: '6af1908f023f5798b0e7849f',
  })
  @IsOptional()
  @IsMongoId()
  before?: string;

  @ApiPropertyOptional({
    description: 'true = only unread messages',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  unreadOnly: boolean = false;
}
