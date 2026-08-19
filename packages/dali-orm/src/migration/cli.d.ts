#!/usr/bin/env node
interface CLIOptions {
    config?: string;
    dryRun?: boolean;
    force?: boolean;
    offline?: boolean;
    to?: string;
    output?: string;
    name?: string;
    schema?: string;
    version?: string;
    /** Snapshot directory for incremental migrations (default: ./meta/snapshots) */
    snapshots?: string;
    /** Generate full migration (ignore snapshots) */
    full?: boolean;
    /** Verbose output (for diff command) */
    verbose?: boolean;
}
/**
 * Convert text to snake_case for migration names.
 * "add user table" → "add_user_table"
 * "Fix Bug!" → "fix_bug"
 */
export declare function slugify(text: string): string;
export declare function main(argv?: string[]): Promise<void>;
export declare function parseGlobalOptions(args: string[]): CLIOptions;
export {};
//# sourceMappingURL=cli.d.ts.map