import type { OrmConfig } from 'dali-orm/sdk/driver/config/types';

const config: OrmConfig = {
  url: 'ws://localhost:10101',
  namespace: 'todo',
  database: 'todo',
  auth: {
    type: 'root',
    username: 'admin',
    password: 'admin',
  },
  migrations: {
    dir: './migrations',
    table: '__migrations',
  },
  schema: {
    dir: '.',
    pattern: 'schema.ts',
  },
};

export default config;
