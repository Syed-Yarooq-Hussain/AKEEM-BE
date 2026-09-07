import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
export class SignupDto {
  @IsString() @MinLength(2) firstName: string;
  @IsString() @MinLength(2) lastName: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsString() @MinLength(2) organizationName: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional()
  @IsString()
  @IsIn(['USD', 'EUR', 'GBP', 'PKR', 'AED'])
  currency?: string;
}
