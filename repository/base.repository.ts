import { FindOptions, Model, ModelStatic, WhereOptions } from 'sequelize';

export class BaseRepository<T extends Model> {
  constructor(protected readonly model: ModelStatic<T>) {}

  findAll(options: FindOptions = {}): Promise<T[]> { return this.model.findAll(options); }
  findById(id: number, options: FindOptions = {}): Promise<T | null> { return this.model.findByPk(id, options); }
  findOne(where: WhereOptions, options: FindOptions = {}): Promise<T | null> { return this.model.findOne({ ...options, where }); }
  create(values: Partial<T['_creationAttributes']>): Promise<T> { return this.model.create(values as T['_creationAttributes']); }
  async updateById(id: number, values: Partial<T['_attributes']>): Promise<T | null> {
    const record = await this.model.findByPk(id); if (!record) return null;
    return record.update(values);
  }
  destroyById(id: number): Promise<number> { return this.model.destroy({ where: { id } as WhereOptions }); }
}
