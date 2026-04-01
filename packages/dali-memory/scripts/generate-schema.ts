import { z } from 'zod';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DaliMemoryConfigSchema } from '../src/config.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '..', 'dali-memory.schema.json');

const jsonSchema = z.toJSONSchema(DaliMemoryConfigSchema);

// $schema in data is a standard JSON Schema reference for editor support
// Must be allowed in root properties since config files use it
jsonSchema.properties = {
  $schema: {
    type: 'string',
    description: 'JSON Schema reference for editor support and validation',
  },
  ...jsonSchema.properties,
};

const result = {
  title: 'DaliMemoryConfig',
  description: 'Configuration schema for dali-memory plugin',
  ...jsonSchema,
  $schema: 'http://json-schema.org/draft-07/schema#',
};

writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
console.log('Generated dali-memory.schema.json');
