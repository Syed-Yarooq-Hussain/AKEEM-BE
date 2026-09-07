import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from '../../repository/user.repository';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from '../../models';

@Module({
  controllers: [UserController],
  providers: [UserService, UserRepository],
  imports: [SequelizeModule.forFeature([User])],
  //imports: [/* ... other modules */, UserRepository],
  exports: [UserService],
})
export class UserModule {}
