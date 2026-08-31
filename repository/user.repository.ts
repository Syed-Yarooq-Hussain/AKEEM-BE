import { Injectable } from '@nestjs/common'; import { InjectModel } from '@nestjs/sequelize';
import { User } from '../models'; import { BaseRepository } from './base.repository';

@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(@InjectModel(User) model: typeof User) { super(model); }
  findByEmail(email: string) { return this.findOne({ email: email.toLowerCase() }); }
  createUser(values: Partial<User['_creationAttributes']>) { return this.create(values); }
  updateUser(id: number, values: Partial<User['_attributes']>) { return this.updateById(id, values); }
  deleteUser(id: number) { return this.destroyById(id); }
}
