import { Injectable } from '@nestjs/common'; import { InjectModel } from '@nestjs/sequelize';
import { Organization } from '../models'; import { BaseRepository } from './base.repository';
@Injectable() export class OrganizationRepository extends BaseRepository<Organization> {
  constructor(@InjectModel(Organization) model: typeof Organization) { super(model); }
  findBySlug(slug: string) { return this.findOne({ slug }); }
}
