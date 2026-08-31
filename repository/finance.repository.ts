import { Injectable } from '@nestjs/common'; import { InjectModel } from '@nestjs/sequelize';
import { Invoice, Transaction } from '../models'; import { BaseRepository } from './base.repository';
@Injectable() export class InvoiceRepository extends BaseRepository<Invoice> { constructor(@InjectModel(Invoice) m: typeof Invoice) { super(m); } }
@Injectable() export class TransactionRepository extends BaseRepository<Transaction> { constructor(@InjectModel(Transaction) m: typeof Transaction) { super(m); } }
