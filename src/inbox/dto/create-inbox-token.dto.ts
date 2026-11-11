import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateInboxTokenDto {
  @ApiProperty({
    description:
      "Your app's id for the logged-in user — the same `to.subscriberId` you send notifications to",
    example: 'user_123',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subscriberId: string;
}
