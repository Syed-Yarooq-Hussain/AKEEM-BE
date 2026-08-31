import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CeoChatService } from './ceo-chat.service';
import { CeoChatDto } from './dto/ceo-chat.dto';

@ApiTags('CEO Chat')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller(['ai/ceo', 'api/ai/ceo'])
export class CeoChatController {
  constructor(private readonly ceoChatService: CeoChatService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Chat with the project-scoped CEO copilot' })
  chat(@Req() request, @Body() dto: CeoChatDto) {
    return this.ceoChatService.chat(request.user, dto);
  }

  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Get a CEO conversation history' })
  history(@Req() request, @Param('conversationId', ParseIntPipe) conversationId: number) {
    return this.ceoChatService.history(request.user, conversationId);
  }
}
