import sql from 'mssql';
import { executeQuery } from '../methods/db.methods';

interface HealthCheckRow {
  result: number;
}

export const checkDatabaseConnection = async (): Promise<boolean> => {
  const rows = await executeQuery<HealthCheckRow>(
    'SELECT @checkValue AS result',
    { checkValue: { type: sql.Int, value: 1 } }
  );

  return rows.length > 0 && rows[0].result === 1;
};
