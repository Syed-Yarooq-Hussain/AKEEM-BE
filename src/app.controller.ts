import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly jwtService: JwtService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('login')
  @UseGuards(AuthGuard('oauth2'))
  async login(@Req() req, @Res() res) {
    // Initiates the OAuth 2.0 authentication flow

    // Assuming you have obtained user information after OAuth authentication
    const user = req.user;

    // Generate JWT token
    const token = this.jwtService.sign({ sub: user.id });

    // Save the JWT token or send it in the response
    // (Note: Save it securely in production, possibly in a HttpOnly cookie)
    res.cookie('access_token', token, { httpOnly: true });
    res.redirect('/');
  }
}
