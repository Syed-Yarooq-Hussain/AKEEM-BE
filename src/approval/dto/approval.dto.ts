import { Type } from 'class-transformer';
import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateApprovalDto {
  @IsString() @MinLength(2) title: string;
  @IsString() @MinLength(1) type: string;
  @IsOptional() @Type(() => Number) projectId?: number;
  @IsOptional() @Type(() => Number) @IsNumber() amount?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsObject() metadata?: object;
}

export class ReviewApprovalDto {
  @IsOptional() @IsString() comment?: string;
}
