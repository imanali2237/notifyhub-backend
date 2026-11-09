import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import type { Env } from '../config/env.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { MailService } from '../mail/mail.service.js';
import { OtpService } from '../otp/otp.service.js';
import {
  EMAIL_VERIFICATION_OTP_PURPOSE,
  TIMING_SAFE_DUMMY_PASSWORD,
} from './auth.constants.js';
import type {
  JwtPayload,
  PublicAccount,
  UserWithTenant,
} from './auth.interfaces.js';
import type { LoginDto } from './dto/login.dto.js';
import type { SignupDto } from './dto/signup.dto.js';
import type { VerifyEmailDto } from './dto/verify-email.dto.js';
import { verificationEmail } from './templates/verification-email.template.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly verificationRequired: boolean;
  private readonly signupEnabled: boolean;

  /** See TIMING_SAFE_DUMMY_PASSWORD — computed once at startup. */
  private readonly dummyHash = argon2.hash(TIMING_SAFE_DUMMY_PASSWORD);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.verificationRequired = config.get('EMAIL_VERIFICATION_REQUIRED');
    this.signupEnabled = config.get('SIGNUP_ENABLED');
  }

  /** Creates the User + their Tenant. Emails an OTP if verification is required. */
  async signup(dto: SignupDto) {
    // SIGNUP_ENABLED=false → only the very first account (the admin) may be created.
    if (!this.signupEnabled && (await this.prisma.user.count()) > 0) {
      throw new ForbiddenException('Signup is disabled on this server');
    }

    // argon2 is deliberately slow → stolen password hashes are expensive to crack.
    const passwordHash = await argon2.hash(dto.password);

    let user: UserWithTenant;
    try {
      // Nested create: Prisma inserts the tenant and the user in ONE transaction.
      // If either insert fails, neither is saved.
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          name: dto.name,
          tenant: { create: { name: dto.tenantName } },
        },
        include: { tenant: true },
      });
    } catch (err) {
      // P2002 = unique constraint violation → this email is already registered.
      // Catching it (instead of checking first) is also safe when two signups race.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw err;
    }

    if (!this.verificationRequired) {
      return {
        message: 'Account created. You can log in now.',
        ...this.toPublic(user),
      };
    }

    // The account exists even if the email fails to send — the user can hit
    // /resend-otp, so we log the error instead of failing the whole signup.
    await this.sendVerificationCode(user.email).catch((err: Error) =>
      this.logger.error(`Could not send OTP to ${user.email}: ${err.message}`),
    );

    return {
      message:
        'Account created. Check your email for a 6-digit verification code.',
      ...this.toPublic(user),
    };
  }

  /** Checks email + password and returns a signed JWT. */
  async login({ email, password }: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    // Same work and same error whether the email or the password is wrong.
    const passwordOk = await argon2.verify(
      user?.passwordHash ?? (await this.dummyHash),
      password,
    );
    if (!user || !passwordOk) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Checked only AFTER the password, so this message can't be used to
    // probe which emails exist.
    if (this.verificationRequired && !user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Email not verified. Enter the code we emailed you, or request a new one.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      tokenType: 'Bearer',
      ...this.toPublic(user),
    };
  }

  /** The logged-in user's profile (used by GET /v1/auth/me). */
  async me(userId: string): Promise<PublicAccount> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
    // Token is valid but the account was deleted since it was issued.
    if (!user) throw new UnauthorizedException('Account no longer exists');
    return this.toPublic(user);
  }

  async verifyEmail({ email, otp }: VerifyEmailDto) {
    this.assertVerificationEnabled();

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('Invalid or expired code');
    if (user.emailVerifiedAt) return { message: 'Email is already verified' };

    const result = await this.otp.verify(
      EMAIL_VERIFICATION_OTP_PURPOSE,
      email,
      otp,
    );
    switch (result) {
      case 'valid':
        await this.prisma.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: new Date() },
        });
        return { message: 'Email verified. You can log in now.' };
      case 'too_many_attempts':
        throw new HttpException(
          'Too many wrong attempts. Request a new code.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      case 'invalid':
      case 'expired':
        throw new BadRequestException('Invalid or expired code');
    }
  }

  /**
   * Always returns the same message, whether or not the account exists, so this
   * endpoint can't be used to discover which emails are registered.
   */
  async resendVerificationCode(email: string) {
    this.assertVerificationEnabled();

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt) {
      await this.sendVerificationCode(email);
    }
    return {
      message:
        'If an unverified account exists for this email, a new code has been sent.',
    };
  }

  private assertVerificationEnabled(): void {
    if (!this.verificationRequired) {
      throw new BadRequestException(
        'Email verification is turned off on this server',
      );
    }
  }

  /** Never return passwordHash — pick only safe fields. */
  private toPublic(user: UserWithTenant): PublicAccount {
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerifiedAt !== null,
      },
      tenant: { id: user.tenant.id, name: user.tenant.name },
    };
  }

  private async sendVerificationCode(email: string): Promise<void> {
    const code = await this.otp.issue(EMAIL_VERIFICATION_OTP_PURPOSE, email);
    await this.mail.send(verificationEmail(email, code));
  }
}
