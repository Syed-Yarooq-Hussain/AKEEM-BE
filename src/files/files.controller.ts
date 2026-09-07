import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FilesService } from './files.service';
@ApiTags('Files & Reports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller(['api', ''])
export class FilesController {
  constructor(private s: FilesService) {}
  @Post('files/upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  upload(@Req() r, @UploadedFile() f: any, @Body() b: any) {
    return this.s.upload(r.user, f, b);
  }
  @Get('files') files(@Req() r, @Query('projectId') p?: string) {
    return this.s.files(r.user, p ? Number(p) : undefined);
  }
  @Get('files/:id') file(@Req() r, @Param('id', ParseIntPipe) id: number) {
    return this.s.file(r.user, id);
  }
  @Delete('files/:id') remove(@Req() r, @Param('id', ParseIntPipe) id: number) {
    return this.s.remove(r.user, id);
  }
  @Get('reports') reports(
    @Req() r,
    @Query('projectId') p?: string,
    @Query('assistant') a?: string,
  ) {
    return this.s.reports(r.user, p ? Number(p) : undefined, a);
  }
  @Post('reports/generate') generate(@Req() r, @Body() b: any) {
    return this.s.generate(r.user, b);
  }
  @Get('reports/:id') report(@Req() r, @Param('id', ParseIntPipe) id: number) {
    return this.s.report(r.user, id);
  }
  @Get('reports/:id/download') download(
    @Req() r,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: any,
  ) {
    return this.s.download(r.user, id, res);
  }
}
