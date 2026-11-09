import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MessageResponseDto } from '../common/dto/message-response.dto.js';
import { ApiErrorResponses } from '../common/swagger/api-error-responses.decorator.js';
import { API_TAGS, JWT_SECURITY } from '../common/swagger/swagger.constants.js';
import type { AuthUser } from './auth.interfaces.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { ResendOtpDto } from './dto/resend-otp.dto.js';
import {
  AccountResponseDto,
  LoginResponseDto,
  SignupResponseDto,
} from './dto/responses/account.response.js';
import { SignupDto } from './dto/signup.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@ApiTags(API_TAGS.auth)
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  @ApiOperation({
    summary: 'Create an account and its tenant',
    description:
      'Creates a user and their tenant in one transaction. If EMAIL_VERIFICATION_REQUIRED=true, a 6-digit code is emailed and must be verified before login. If SIGNUP_ENABLED=false, only the first account can be created.',
  })
  @ApiCreatedResponse({ type: SignupResponseDto })
  @ApiErrorResponses({
    400: 'Invalid body',
    403: 'Signup is disabled on this server',
    409: 'An account with this email already exists',
  })
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in and get an access token (JWT)',
    description:
      'Use the returned `accessToken` as `Authorization: Bearer <token>` for dashboard routes.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiErrorResponses({
    400: 'Invalid body',
    401: 'Invalid email or password',
    403: 'Email not verified (only when EMAIL_VERIFICATION_REQUIRED=true)',
  })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(JWT_SECURITY)
  @ApiOperation({ summary: 'Get the logged-in user and tenant' })
  @ApiOkResponse({ type: AccountResponseDto })
  @ApiErrorResponses({ 401: 'Missing, invalid or expired token' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.userId);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify your email with the 6-digit code',
    description:
      'Codes expire after OTP_TTL_SECONDS (default 15 min) and allow OTP_MAX_ATTEMPTS (default 5) wrong guesses.',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiErrorResponses({
    400: 'Invalid or expired code, or verification is turned off',
    429: 'Too many wrong attempts — request a new code',
  })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Email a new verification code',
    description:
      'Always returns the same message whether or not the account exists. Limited to one code per OTP_RESEND_COOLDOWN_SECONDS (default 60s).',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiErrorResponses({
    400: 'Invalid body, or verification is turned off',
    429: 'Wait before requesting another code',
  })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.auth.resendVerificationCode(dto.email);
  }
}
