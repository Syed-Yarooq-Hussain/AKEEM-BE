import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class InspectInvitationDto {
  @IsString()
  @MinLength(32)
  token: string;
}

export class AcceptInvitationDto extends InspectInvitationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
