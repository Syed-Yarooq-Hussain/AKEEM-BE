import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

@ApiTags('Organization')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller(['organization', 'api/organization'])
export class OrganizationController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  get(@Req() request) {
    return this.service.organization(request.user);
  }

  @Patch()
  update(@Req() request, @Body() body: any) {
    return this.service.updateOrganization(request.user, body);
  }

  @Get('roles')
  roles(@Req() request) {
    return this.service.roleDirectory(request.user);
  }

  @Get('members')
  members(@Req() request) {
    return this.service.members(request.user);
  }

  @Post('invitations')
  invite(@Req() request, @Body() body: any) {
    return this.service.invite(request.user, body);
  }

  @Patch('members/:id/role')
  role(
    @Req() request,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    return this.service.memberRole(request.user, id, body);
  }

  @Delete('members/:id')
  remove(@Req() request, @Param('id', ParseIntPipe) id: number) {
    return this.service.removeMember(request.user, id);
  }
}

@ApiTags('User Settings')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller(['users/me', 'api/users/me'])
export class UserSettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  get(@Req() request) {
    return this.service.user(request.user);
  }

  @Patch()
  update(@Req() request, @Body() body: any) {
    return this.service.updateUser(request.user, body);
  }

  @Patch('password')
  password(@Req() request, @Body() body: any) {
    return this.service.password(request.user, body);
  }

  @Patch('preferences')
  preferences(@Req() request, @Body() body: any) {
    return this.service.preferences(request.user, body);
  }

  @Post('avatar')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('avatar', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  avatar(@Req() request, @UploadedFile() file: any) {
    return this.service.avatar(request.user, file);
  }
}
