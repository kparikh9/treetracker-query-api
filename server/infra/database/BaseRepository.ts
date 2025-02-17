/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-restricted-syntax */
import { Knex } from 'knex';
import HttpError from 'utils/HttpError';
import Session from './Session';

type FilterOptions<T> = {
  limit?: number;
  orderBy?: { column: keyof T; direction?: 'asc' | 'desc' };
};

export default class BaseRepository<T> {
  tableName: string;

  session: Session;

  constructor(tableName: string, session: Session) {
    this.tableName = tableName;
    this.session = session;
  }

  async getById(id: string | number): Promise<T> {
    const object = await this.session
      .getDB()
      .select()
      .table(this.tableName)
      .where('id', id)
      .first();
    if (!object) {
      throw new HttpError(404, `Can not found ${this.tableName} by id:${id}`);
    }
    return object;
  }

  /*
   * select by filter
   * support: and / or
   * options:
   *  limit: number
   */

  async getByFilter(filter: unknown, options?: FilterOptions<T>): Promise<T[]> {
    const whereBuilder = function (object: any, builder: Knex.QueryBuilder) {
      let result = builder;
      if (object.and) {
        for (const one of object.and) {
          if (one.or) {
            result = result.andWhere((subBuilder) =>
              whereBuilder(one, subBuilder),
            );
          } else {
            result = result.andWhere(
              Object.keys(one)[0],
              Object.values(one)[0] as any,
            );
          }
        }
      } else if (object.or) {
        for (const one of object.or) {
          if (one.and) {
            result = result.orWhere((subBuilder) =>
              whereBuilder(one, subBuilder),
            );
          } else {
            result = result.orWhere(
              Object.keys(one)[0],
              Object.values(one)[0] as any,
            );
          }
        }
      } else {
        result.where(object);
      }
      return result;
    };

    let promise = this.session
      .getDB()
      .select()
      .table(this.tableName)
      .where((builder) => whereBuilder(filter, builder));
    if (options && options.limit) {
      promise = promise.limit(options && options.limit);
    }
    if (options && options.orderBy) {
      const direction =
        options.orderBy.direction !== undefined
          ? options.orderBy.direction
          : 'asc';
      promise = promise.orderBy(options.orderBy.column as string, direction);
    }
    const result = await promise;
    return result as T[];
  }

  async countByFilter(filter: T) {
    const result = await this.session
      .getDB()
      .count()
      .table(this.tableName)
      .where(filter);
    return parseInt(result[0].count.toString());
  }

  async update(object: T & { id: string | number }) {
    const result = await this.session
      .getDB()(this.tableName)
      .update(object)
      .where('id', object.id)
      .returning('*');
    return result[0];
  }

  async create(object: T) {
    const result = await this.session
      .getDB()(this.tableName)
      .insert(object)
      .returning('*');
    return result[0];
  }
}
