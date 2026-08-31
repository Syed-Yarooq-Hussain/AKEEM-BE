import { BelongsTo, Column, DataType, ForeignKey, Table } from 'sequelize-typescript';
import { BaseModel } from './base.model'; import { Organization, User } from './core.models';

@Table({ tableName: 'departments', underscored: true, paranoid: true })
export class Department extends BaseModel<Department> {
  @ForeignKey(() => Organization) @Column(DataType.INTEGER) declare organizationId: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare managerId?: number;
  @Column({ allowNull: false }) declare name: string; @Column declare description?: string;
}
@Table({ tableName: 'employees', underscored: true, paranoid: true })
export class Employee extends BaseModel<Employee> {
  @ForeignKey(() => Organization) @Column(DataType.INTEGER) declare organizationId: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare userId?: number;
  @ForeignKey(() => Department) @Column(DataType.INTEGER) declare departmentId?: number;
  @ForeignKey(() => Employee) @Column(DataType.INTEGER) declare managerEmployeeId?: number;
  @Column({ allowNull: false }) declare employeeNumber: string; @Column({ allowNull: false }) declare firstName: string;
  @Column({ allowNull: false }) declare lastName: string; @Column declare workEmail?: string; @Column declare phone?: string;
  @Column declare jobTitle?: string; @Column declare employmentType?: string; @Column declare hireDate?: Date;
  @Column declare terminationDate?: Date; @Column({ defaultValue: 'active' }) declare status: string;
  @Column({ type: DataType.DECIMAL(14, 2) }) declare salary?: number; @Column declare salaryCurrency?: string;
  @Column({ type: DataType.JSONB, defaultValue: {} }) declare emergencyContact: object;
  @BelongsTo(() => Department) declare department?: Department;
}
@Table({ tableName: 'leave_requests', underscored: true, paranoid: true })
export class LeaveRequest extends BaseModel<LeaveRequest> {
  @ForeignKey(() => Organization) @Column(DataType.INTEGER) declare organizationId: number;
  @ForeignKey(() => Employee) @Column(DataType.INTEGER) declare employeeId: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) declare reviewedById?: number;
  @Column({ allowNull: false }) declare type: string; @Column declare startDate: Date; @Column declare endDate: Date;
  @Column({ type: DataType.DECIMAL(5, 2) }) declare days: number; @Column({ defaultValue: 'pending' }) declare status: string;
  @Column({ type: DataType.TEXT }) declare reason?: string; @Column({ type: DataType.TEXT }) declare reviewNote?: string;
}
@Table({ tableName: 'attendance_entries', underscored: true, paranoid: true })
export class AttendanceEntry extends BaseModel<AttendanceEntry> {
  @ForeignKey(() => Organization) @Column(DataType.INTEGER) declare organizationId: number;
  @ForeignKey(() => Employee) @Column(DataType.INTEGER) declare employeeId: number;
  @Column declare clockIn: Date; @Column declare clockOut?: Date;
  @Column({ type: DataType.DECIMAL(6, 2) }) declare hours?: number; @Column({ defaultValue: 'present' }) declare status: string;
  @Column({ type: DataType.TEXT }) declare note?: string;
}
