import {
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  AutoIncrement,
  UpdatedAt,
} from 'sequelize-typescript';

export abstract class BaseModel<T = any> extends Model<T> {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare id: number;

  @CreatedAt
  @Column({ field: 'created_at' })
  declare createdAt: Date;

  @UpdatedAt
  @Column({ field: 'updated_at' })
  declare updatedAt: Date;

  // Paranoid tables add this timestamp from their @Table options. Keeping the
  // property undecorated prevents non-paranoid join/audit models from querying
  // a deleted_at column that does not exist in their migrations.
  declare deletedAt?: Date;
}
