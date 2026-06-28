import type { OrmConfig } from '@woss/dali-orm/sdk/driver/config/types';

const config: OrmConfig = {
  url: 'ws://localhost:10101',
  namespace: 'memory',
  database: 'memory',
  auth: {
    type: 'root',
    username: 'admin',
    password: 'admin',
  },
  schema: {
    dir: './src/lib/server/db',
    pattern: 'schema.ts',
  },
};

export default config;
