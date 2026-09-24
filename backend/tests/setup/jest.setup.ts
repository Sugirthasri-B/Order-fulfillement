import { closePool } from '../../src/config/db';

afterAll(async () => {
  await closePool();
});
