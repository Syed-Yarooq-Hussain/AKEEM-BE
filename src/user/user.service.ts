import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { User } from '../../models';
import { UserRepository } from '../../repository/user.repository';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}


  async create(user: User): Promise<User> {
    return this.userRepository.createUser(user);
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  async findOne(id: number): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  async update(id: number, updateUserDto: Partial<User>) {
    return this.userRepository.updateUser(id, updateUserDto);
  }

  async remove(id: number): Promise<number> {
    const result = await this.userRepository.deleteUser(id);
    return result;
  }
}
