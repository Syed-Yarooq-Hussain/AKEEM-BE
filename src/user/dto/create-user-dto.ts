export class CreateUserDto {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  passwordHash: string;
  createdAt?: Date;
}
