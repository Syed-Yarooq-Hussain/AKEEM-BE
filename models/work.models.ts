import {
  BelongsTo,
  BelongsToMany,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Table,
} from 'sequelize-typescript';
import { BaseModel } from './base.model';
import { Organization, User } from './core.models';
import { Company, Contact, Deal } from './crm.models';

@Table({ tableName: 'projects', underscored: true, paranoid: true })
export class Project extends BaseModel<Project> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @ForeignKey(() => Company)
  @Column(DataType.INTEGER)
  declare companyId?: number;
  @ForeignKey(() => Contact)
  @Column(DataType.INTEGER)
  declare contactId?: number;
  @ForeignKey(() => Deal) @Column(DataType.INTEGER) declare dealId?: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare ownerId?: number;
  @Column({ allowNull: false }) declare name: string;
  @Column({ type: DataType.TEXT }) declare description?: string;
  @Column({ defaultValue: 'planned' }) declare status: string;
  @Column declare color?: string;
  @Column declare startDate?: Date;
  @Column declare dueDate?: Date;
  @Column({ type: DataType.DECIMAL(14, 2) }) declare budget?: number;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare settings: object;
  @HasMany(() => Task) declare tasks: Task[];
}

@Table({ tableName: 'tasks', underscored: true, paranoid: true })
export class Task extends BaseModel<Task> {
  @ForeignKey(() => Organization)
  @Column(DataType.INTEGER)
  declare organizationId: number;
  @ForeignKey(() => Project)
  @Column(DataType.INTEGER)
  declare projectId?: number;
  @ForeignKey(() => Task)
  @Column(DataType.INTEGER)
  declare parentTaskId?: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare createdById: number;
  @Column({ allowNull: false }) declare title: string;
  @Column({ type: DataType.TEXT }) declare description?: string;
  @Column({ defaultValue: 'todo' }) declare status: string;
  @Column({ defaultValue: 'medium' }) declare priority: string;
  @Column declare startAt?: Date;
  @Column declare dueAt?: Date;
  @Column declare completedAt?: Date;
  @Column({ type: DataType.DECIMAL(8, 2) }) declare estimatedHours?: number;
  @Column({ defaultValue: 0 }) declare position: number;
  @BelongsToMany(() => User, () => TaskAssignee) declare assignees: User[];
  @HasMany(() => TaskComment) declare comments: TaskComment[];
}

@Table({
  tableName: 'task_assignees',
  underscored: true,
  timestamps: true,
  paranoid: false,
})
export class TaskAssignee extends BaseModel<TaskAssignee> {
  @ForeignKey(() => Task) @Column(DataType.INTEGER) declare taskId: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare userId: number;
}

@Table({ tableName: 'task_comments', underscored: true, paranoid: true })
export class TaskComment extends BaseModel<TaskComment> {
  @ForeignKey(() => Task) @Column(DataType.INTEGER) declare taskId: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare userId: number;
  @ForeignKey(() => TaskComment)
  @Column(DataType.INTEGER)
  declare parentId?: number;
  @Column({ type: DataType.TEXT, allowNull: false }) declare body: string;
  @Column({ type: DataType.JSONB, defaultValue: [] })
  declare mentions: string[];
}
