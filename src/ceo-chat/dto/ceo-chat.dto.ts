import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CeoChatDto {
  @IsInt() projectId: number;
  @IsString() @MinLength(1) @MaxLength(4000) message: string;
  @IsOptional() @IsInt() conversationId?: number;
}
