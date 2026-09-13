import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SettingsService } from './settings.service';
import { AcceptInvitationDto } from './dto/invitation.dto';

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
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Invite a member and report actual email delivery' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', format: 'email' },
        roleId: { type: 'integer' },
        role: { type: 'string', example: 'Member' },
      },
    },
  })
  invite(@Req() request, @Body() body: any) {
    return this.service.invite(request.user, body);
  }

  @Post('invitations/:id/resend')
  @ApiOperation({ summary: 'Rotate and resend a pending invitation token' })
  resendInvitation(@Req() request, @Param('id', ParseIntPipe) id: number) {
    return this.service.resendInvitation(request.user, id);
  }

  @Delete('invitations/:id')
  @ApiOperation({ summary: 'Revoke a pending invitation' })
  revokeInvitation(@Req() request, @Param('id', ParseIntPipe) id: number) {
    return this.service.revokeInvitation(request.user, id);
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

@ApiTags('Organization Invitations')
@Controller(['organization/invitations', 'api/organization/invitations'])
export class InvitationAcceptanceController {
  constructor(private readonly service: SettingsService) {}

  @Get('accept')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Inspect a single-use invitation token' })
  @ApiQuery({
    name: 'token',
    required: true,
    schema: { type: 'string', minLength: 32 },
  })
  inspect(@Query('token') token: string) {
    return this.service.inspectInvitation(String(token || ''));
  }

  @Post('accept')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Accept an invitation using a new or verified existing account',
  })
  accept(@Body() body: AcceptInvitationDto) {
    return this.service.acceptInvitation(body);
  }

  @Post('accept-authenticated')
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept an invitation as the signed-in user' })
  acceptAuthenticated(@Req() request, @Body() body: AcceptInvitationDto) {
    return this.service.acceptInvitation(body, request.user.id);
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
