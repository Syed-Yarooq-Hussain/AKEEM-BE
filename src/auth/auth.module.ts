import 'dotenv/config';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SequelizeModule } from '@nestjs/sequelize';
import { Membership, Organization, Role, User } from '../../models';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.stretegy';

@Module({
  imports: [
    SequelizeModule.forFeature([User, Organization, Role, Membership]), PassportModule,
    JwtModule.register({ secret: process.env.JWT_SECRET || 'development-only-change-this-secret', signOptions: { expiresIn: '1h' } }),
  ],
  controllers: [AuthController], providers: [AuthService, JwtStrategy], exports: [AuthService, JwtModule],
})
export class AuthModule {}
