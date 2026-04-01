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
};

export default config;
