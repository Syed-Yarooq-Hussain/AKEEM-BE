import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ASSISTANTS } from '../assistant.config';

export class CeoChatDto {
  @IsOptional() @IsInt() projectId?: number;
  @IsString() @MinLength(1) @MaxLength(4000) message: string;
  @IsOptional() @IsInt() conversationId?: number;
  @IsOptional() @IsIn(ASSISTANTS) assistant?: string;
  @IsOptional() @IsIn(['auto', 'suggest']) executionMode?: 'auto' | 'suggest';
  @IsOptional() @IsObject() context?: {
    module?: string;
    page?: string;
    entityType?: string;
    entityId?: number;
    selection?: object;
  };
}
