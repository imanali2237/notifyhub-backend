import type { NotificationResponseDto } from './dto/notification.response.js';
import type { Notification } from './schemas/notification.schema.js';

type NotificationRecord = Notification & {
  _id: { toString(): string };
  __v?: number;
};

/** Mongo document → API response: `_id` becomes `id`, internal `__v` is dropped. */
export function toNotificationResponse(
  doc: NotificationRecord,
): NotificationResponseDto {
  const { _id, __v: _version, ...rest } = doc;
  return { id: _id.toString(), ...rest } as NotificationResponseDto;
}
