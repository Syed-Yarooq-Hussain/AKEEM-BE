import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
export class RefreshTokenDto {
  @IsString() refreshToken: string;
}
export class LogoutDto {
  @IsOptional() @IsString() refreshToken?: string;
}
export class ForgotPasswordDto {
  @IsEmail() email: string;
}
export class ResetPasswordDto {
  @IsString() token: string;
  @IsString() @MinLength(8) password: string;
}
