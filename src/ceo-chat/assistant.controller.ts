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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CeoChatService } from './ceo-chat.service';
import { CeoChatDto } from './dto/ceo-chat.dto';
import { ConversationQueryDto } from './dto/conversation-query.dto';
import { isAssistant } from './assistant.config';

@ApiTags('AI Assistants')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller(['ai/:assistant', 'api/ai/:assistant'])
export class AssistantController {
  constructor(private service: CeoChatService) {}
  @Post('chat') chat(
    @Req() req,
    @Param('assistant') assistant: string,
    @Body() dto: CeoChatDto,
  ) {
    this.valid(assistant);
    return this.service.chat(req.user, dto, assistant);
  }
  @Get('conversations') list(
    @Req() req,
    @Param('assistant') assistant: string,
    @Query() query: ConversationQueryDto,
  ) {
    this.valid(assistant);
    return this.service.listConversations(req.user, query, assistant);
  }
  @Get('conversations/:id/messages') messages(
    @Req() req,
    @Param('assistant') assistant: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.valid(assistant);
    return this.service.history(req.user, id, assistant);
  }
  @Delete('conversations/:id') remove(
    @Req() req,
    @Param('assistant') assistant: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.valid(assistant);
    return this.service.deleteConversation(req.user, id, assistant);
  }
  private valid(value: string) {
    if (!isAssistant(value))
      throw new NotFoundException('Unknown AI assistant');
  }
}
