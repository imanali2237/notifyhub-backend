import { ApiProperty } from '@nestjs/swagger';

export class AccountUserDto {
  @ApiProperty({
    format: 'uuid',
    example: 'de3cc034-5d14-48d5-99df-3affdf1f4c3d',
  })
  id: string;

  @ApiProperty({ example: 'ali@myshop.com' })
  email: string;

  @ApiProperty({ type: String, nullable: true, example: 'Ali' })
  name: string | null;

  @ApiProperty({ example: true })
  emailVerified: boolean;
}

export class AccountTenantDto {
  @ApiProperty({
    format: 'uuid',
    example: 'b3f85292-70e9-472d-91de-23c4876989cb',
  })
  id: string;

  @ApiProperty({ example: 'MyShop' })
  name: string;
}

/** The logged-in user and their tenant. Never includes the password hash. */
export class AccountResponseDto {
  @ApiProperty({ type: AccountUserDto })
  user: AccountUserDto;

  @ApiProperty({ type: AccountTenantDto })
  tenant: AccountTenantDto;
}

export class SignupResponseDto extends AccountResponseDto {
  @ApiProperty({
    example:
      'Account created. Check your email for a 6-digit verification code.',
  })
  message: string;
}

export class LoginResponseDto extends AccountResponseDto {
  @ApiProperty({
    description:
      'Send as `Authorization: Bearer <accessToken>`. Expires after JWT_EXPIRES_IN.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZTNj…',
  })
  accessToken: string;

  @ApiProperty({ example: 'Bearer', enum: ['Bearer'] })
  tokenType: 'Bearer';
}
