import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { isAssistant, publicAssistantDirectory } from './assistant.config';
import { CeoChatService } from './ceo-chat.service';
import { CeoChatDto } from './dto/ceo-chat.dto';
import { ConversationQueryDto } from './dto/conversation-query.dto';
import { DelegationQueryDto } from './dto/delegation-query.dto';

@ApiTags('AI Orchestrator')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller(['ai', 'api/ai'])
export class OrchestratorController {
  constructor(private readonly service: CeoChatService) {}

  @Get('assistants')
  @ApiOperation({
    summary:
      'List available specialist assistants, models, capabilities, and safe actions',
  })
  assistants() {
    return {
      items: publicAssistantDirectory(),
      defaultAssistant: 'ceo',
      executionModes: ['auto', 'suggest'],
    };
  }

  @Post('chat')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Context-aware chat that can delegate to specialist agents and execute safe actions',
  })
  chat(@Req() request, @Body() dto: CeoChatDto) {
    return this.service.chat(request.user, dto, dto.assistant || 'ceo');
  }

  @Get('conversations')
  conversations(
    @Req() request,
    @Query() query: ConversationQueryDto,
    @Query('assistant') assistant?: string,
  ) {
    if (assistant && !isAssistant(assistant))
      throw new NotFoundException('Unknown AI assistant');
    return this.service.listConversations(request.user, query, assistant);
  }

  @Post('conversations')
  @ApiOperation({
    summary: 'Prepare a conversation before chat to track agent progress',
  })
  prepareConversation(@Req() request, @Body() dto: CeoChatDto) {
    return this.service.prepareConversation(request.user, dto);
  }

  @Get('conversations/:id/messages')
  messages(@Req() request, @Param('id', ParseIntPipe) id: number) {
    return this.service.history(request.user, id);
  }

  @Delete('conversations/:id')
  remove(@Req() request, @Param('id', ParseIntPipe) id: number) {
    return this.service.deleteConversation(request.user, id);
  }

  @Get('delegations')
  delegations(@Req() request, @Query() query: DelegationQueryDto) {
    return this.service.listDelegations(request.user, query);
  }

  @Get('delegations/:id')
  delegation(@Req() request, @Param('id', ParseIntPipe) id: number) {
    return this.service.getDelegation(request.user, id);
  }
}
