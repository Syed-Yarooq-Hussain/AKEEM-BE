import { Injectable } from '@nestjs/common'; import { InjectModel } from '@nestjs/sequelize';
import { Project, Task } from '../models'; import { BaseRepository } from './base.repository';
@Injectable() export class ProjectRepository extends BaseRepository<Project> { constructor(@InjectModel(Project) m: typeof Project) { super(m); } }
@Injectable() export class TaskRepository extends BaseRepository<Task> { constructor(@InjectModel(Task) m: typeof Task) { super(m); } }
