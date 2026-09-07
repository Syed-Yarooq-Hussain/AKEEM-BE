import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class DelegationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() conversationId?: number;
  @IsOptional() @Type(() => Number) @IsInt() projectId?: number;
  @IsOptional()
  @IsIn(['pending', 'running', 'completed', 'failed'])
  status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
