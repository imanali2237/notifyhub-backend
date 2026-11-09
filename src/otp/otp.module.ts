import { Module } from '@nestjs/common';
import { OtpService } from './otp.service.js';

/** One-time codes stored (hashed) in Redis. Reusable: email verification, password reset... */
@Module({
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
