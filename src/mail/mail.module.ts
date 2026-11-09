import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module.js';
import { MailService } from './mail.service.js';

@Module({
  imports: [ProvidersModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
