import {
  Controller,
  Get,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CeoChatService } from './ceo-chat.service';

@ApiTags('CEO Chat')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller(['ai/ceo', 'api/ai/ceo'])
export class CeoChatController {
  constructor(private readonly ceoChatService: CeoChatService) {}

  @Get('briefing')
  @ApiOperation({ summary: 'Get a deterministic project executive briefing' })
  briefing(
    @Req() request,
    @Query('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.ceoChatService.briefing(request.user, projectId);
  }
}
