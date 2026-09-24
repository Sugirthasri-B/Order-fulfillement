import sql from 'mssql';
import { getPool } from '../config/db';

export type QueryParams = Record<
  string,
  { type: (() => sql.ISqlType) | sql.ISqlType; value: unknown }
>;

/**
 * Executes a parameterized SQL query and returns the resulting recordset.
 * All query inputs must be passed via `params` (never string-concatenated)
 * to protect against SQL injection.
 */
export const executeQuery = async <T = unknown>(
  query: string,
  params: QueryParams = {}
): Promise<T[]> => {
  const pool = await getPool();
  const request = pool.request();

  for (const [name, param] of Object.entries(params)) {
    request.input(name, param.type, param.value);
  }

  const result = await request.query<T>(query);
  return result.recordset;
};

export type TransactionQueryExecutor = <T = unknown>(
  query: string,
  params?: QueryParams
) => Promise<T[]>;

/**
 * Runs `work` inside a single SQL Server transaction. `work` receives a
 * query executor scoped to that transaction; all statements it runs are
 * committed together, or rolled back together if any of them throws.
 */
export const withTransaction = async <T>(
  work: (executeInTransaction: TransactionQueryExecutor) => Promise<T>
): Promise<T> => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  const executeInTransaction: TransactionQueryExecutor = async (query, params = {}) => {
    const request = new sql.Request(transaction);

    for (const [name, param] of Object.entries(params)) {
      request.input(name, param.type, param.value);
    }

    const result = await request.query(query);
    return result.recordset;
  };

  try {
    const result = await work(executeInTransaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * True when `error` is a SQL Server primary-key/unique-constraint violation
 * (2627, or 2601 for a unique index), e.g. from two concurrent requests
 * racing to insert the same order.
 */
export const isDuplicateKeyError = (error: unknown): boolean => {
  const sqlError = error as { number?: number };
  return sqlError?.number === 2627 || sqlError?.number === 2601;
};
