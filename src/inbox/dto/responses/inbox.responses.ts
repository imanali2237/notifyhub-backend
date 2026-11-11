import { ApiProperty } from '@nestjs/swagger';
import type { InboxMessageView, InboxPage } from '../../inbox.interfaces.js';

export class InboxTokenResponseDto {
  @ApiProperty({
    description:
      'Give this to the browser. It works for this subscriber only, for INBOX_TOKEN_EXPIRES_IN (default 12h).',
    example: 'eyJhbGciOiJIUzI1NiIs...',
  })
  token: string;

  @ApiProperty({ example: 'user_123' })
  subscriberId: string;

  @ApiProperty({ example: '2026-11-12T09:00:00.000Z' })
  expiresAt: Date;
}

export class InboxMessageResponseDto implements InboxMessageView {
  @ApiProperty({ example: '6af1908f023f5798b0e7849f' })
  id: string;

  @ApiProperty({ type: String, nullable: true, example: 'Order A42 shipped' })
  title: string | null;

  @ApiProperty({
    description: 'Show as plain text, never as HTML',
    example: 'Hi Sara, it arrives tomorrow.',
  })
  body: string;

  @ApiProperty({ type: String, nullable: true, example: '/orders/A42' })
  actionUrl: string | null;

  @ApiProperty({ example: false })
  read: boolean;

  @ApiProperty({ type: Date, nullable: true, example: null })
  readAt: Date | null;

  @ApiProperty({ example: '2026-11-11T09:00:00.000Z' })
  createdAt: Date;
}

export class InboxPageResponseDto implements InboxPage {
  @ApiProperty({ type: [InboxMessageResponseDto] })
  messages: InboxMessageResponseDto[];

  @ApiProperty({ example: 3 })
  unreadCount: number;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Pass as `before` for the next (older) page; null = no more',
    example: null,
  })
  nextCursor: string | null;
}

export class UnreadCountResponseDto {
  @ApiProperty({ example: 3 })
  unreadCount: number;
}

export class MarkAllReadResponseDto {
  @ApiProperty({ description: 'Messages that were unread', example: 3 })
  updated: number;

  @ApiProperty({ example: 0 })
  unreadCount: number;
}
