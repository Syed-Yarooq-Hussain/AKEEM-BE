import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ASSISTANTS } from '../../ceo-chat/assistant.config';
export class CreateAiTaskDto {
  @IsInt() projectId: number;
  @IsString() @MinLength(2) title: string;
  @IsOptional() @IsString() description?: string;
  @IsIn(ASSISTANTS) assistant: string;
  @IsOptional() @IsIn(['low', 'medium', 'high', 'urgent']) priority?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsObject() input?: object;
  @IsOptional() @IsBoolean() runNow?: boolean;
  @IsOptional() @IsIn(['auto', 'suggest']) executionMode?: 'auto' | 'suggest';
}
export class UpdateAiTaskDto extends PartialType(CreateAiTaskDto) {}
export class AiTaskQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() projectId?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() assistant?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
