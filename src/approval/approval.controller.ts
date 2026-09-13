import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApprovalService } from './approval.service';
import { CreateApprovalDto, ReviewApprovalDto } from './dto/approval.dto';
@ApiTags('Approvals')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller(['approvals', 'api/approvals'])
export class ApprovalController {
  constructor(private s: ApprovalService) {}
  @Get() list(
    @Req() r,
    @Query('projectId') p?: string,
    @Query('status') st?: string,
  ) {
    return this.s.list(r.user, p ? Number(p) : undefined, st);
  }
  @Post() create(@Req() r, @Body() b: CreateApprovalDto) {
    return this.s.create(r.user, b);
  }
  @Get(':id') one(@Req() r, @Param('id', ParseIntPipe) id: number) {
    return this.s.one(r.user, id);
  }
  @Post(':id/approve') approve(
    @Req() r,
    @Param('id', ParseIntPipe) id: number,
    @Body() b: ReviewApprovalDto,
  ) {
    return this.s.review(r.user, id, 'approved', b?.comment);
  }
  @Post(':id/reject') reject(
    @Req() r,
    @Param('id', ParseIntPipe) id: number,
    @Body() b: ReviewApprovalDto,
  ) {
    return this.s.review(r.user, id, 'rejected', b?.comment);
  }
}
