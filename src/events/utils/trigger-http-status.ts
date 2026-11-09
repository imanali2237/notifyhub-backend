import { HttpStatus } from '@nestjs/common';
import type { TriggerResult } from '../events.interfaces.js';

/** 202 when newly queued, 200 when it's a duplicate (idempotencyKey reused). */
export function triggerHttpStatus(result: TriggerResult): HttpStatus {
  return result.status === 'queued' ? HttpStatus.ACCEPTED : HttpStatus.OK;
}
