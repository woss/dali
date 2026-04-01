// @ts-expect-error - dali-orm not installed in examples
import { connect } from 'dali-orm/sdk/driver/orm-connection.js';

const driver = await connect({
  nodeDriver: {
    url: 'ws://localhost:10101',
    namespace: 'todo',
    database: 'todo',
    auth: { type: 'root', username: 'admin', password: 'admin' },
  },
});

const result = await driver.query('SELECT * FROM __migrations');
console.log(JSON.stringify(result, null, 2));

await driver.disconnect();
