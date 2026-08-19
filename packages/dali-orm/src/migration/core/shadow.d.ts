import type { SurrealDriver } from '../../sdk/driver/types.js';
import type { Config } from '../config.js';
/**
 * Shadow database configuration
 */
export interface ShadowConfig {
    namespace: string;
    database: string;
}
/**
 * Result of shadow validation
 */
export interface ShadowValidationResult {
    success: boolean;
    errors: string[];
    appliedCount: number;
}
/**
 * Create a new connection to the shadow database.
 * Shadow DB auto-created on first USE by SurrealDB.
 */
export declare function connectToShadow(config: Config, shadow: ShadowConfig): Promise<SurrealDriver>;
/**
 * Destroy the shadow database after validation.
 * Best-effort — non-fatal if cleanup fails.
 */
export declare function destroyShadow(driver: SurrealDriver, shadow: ShadowConfig): Promise<void>;
/**
 * Validate pending migrations on shadow DB.
 * Applies all pending migrations, returns success/error.
 */
export declare function validateWithShadow(shadowDriver: SurrealDriver, options?: {
    targetVersion?: string;
    migrationsDir?: string;
    migrationsTable?: string;
    journalDir?: string;
}): Promise<ShadowValidationResult>;
//# sourceMappingURL=shadow.d.ts.map