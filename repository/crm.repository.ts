import { Injectable } from '@nestjs/common'; import { InjectModel } from '@nestjs/sequelize';
import { Company, Contact, Deal } from '../models'; import { BaseRepository } from './base.repository';
@Injectable() export class CompanyRepository extends BaseRepository<Company> { constructor(@InjectModel(Company) m: typeof Company) { super(m); } }
@Injectable() export class ContactRepository extends BaseRepository<Contact> { constructor(@InjectModel(Contact) m: typeof Contact) { super(m); } }
@Injectable() export class DealRepository extends BaseRepository<Deal> { constructor(@InjectModel(Deal) m: typeof Deal) { super(m); } }
