import { EmbeddedDriver } from '../../../sdk/driver/embedded-driver.js';
import type { Config } from '../../config.js';
/** Create fresh embedded driver with unique ns/db */
export declare function createTestDriver(mode?: 'memory' | 'surrealkv', dbPath?: string): EmbeddedDriver;
/** Create temp directory, return path */
export declare function createTempDir(prefix?: string): Promise<string>;
/** Clean up temp directory */
export declare function cleanupDir(dir: string): Promise<void>;
/** Minimal valid Config for embedded driver testing */
export declare function testConfig(overrides?: Partial<Config>): Config;
/** Create a migration surql file in dir with timestamp + name */
export declare function createMigrationFile(dir: string, name: string, upStatements: string[]): Promise<string>;
/** Mock console.log and console.error, returning restore function */
export declare function mockConsole(): () => void;
/** Mock process.exit, returning restore function */
export declare function mockProcessExit(): () => void;
/** Create schema.ts file content for testing generate/diff */
export declare function createSchemaFileContent(tables: Array<{
    name: string;
    columns: Array<{
        name: string;
        type: string;
    }>;
}>): string;
//# sourceMappingURL=helpers.d.ts.map