import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AutomationTriggerDto {
  @IsOptional() @IsString() cron?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) intervalMinutes?: number;
  @IsOptional() @IsString() timezone?: string;
}

export class AutomationActionDto {
  @IsString() @MinLength(1) type: string;
  @IsOptional() @IsObject() payload?: Record<string, any>;
}

export class CreateAutomationDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Number) @IsInt() projectId?: number;
  @ValidateNested()
  @Type(() => AutomationTriggerDto)
  trigger: AutomationTriggerDto;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutomationActionDto)
  actions: AutomationActionDto[];
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  retryLimit?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(300)
  timeoutSeconds?: number;
  @IsOptional() @IsDateString() nextRunAt?: string;
}

export class UpdateAutomationDto extends PartialType(CreateAutomationDto) {}

export class RunAutomationDto {
  @IsOptional() @IsString() @MinLength(1) idempotencyKey?: string;
}
