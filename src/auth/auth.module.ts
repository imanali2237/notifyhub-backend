import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { MailModule } from '../mail/mail.module.js';
import { OtpModule } from '../otp/otp.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

type JwtExpiresIn = NonNullable<JwtModuleOptions['signOptions']>['expiresIn'];

@Module({
  imports: [
    MailModule,
    OtpModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): JwtModuleOptions => ({
        secret: config.get('JWT_SECRET'),
        // e.g. "8h" — the token stops working after this
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN') as JwtExpiresIn,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  // Exported so other modules (API keys, templates...) can protect their routes.
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
