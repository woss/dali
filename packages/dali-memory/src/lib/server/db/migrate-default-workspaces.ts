import type { SurrealDriver } from '@woss/dali-orm';
import { RecordId } from 'surrealdb';

export interface MigrationResult {
  /** Number of users processed (without default_workspace_id) */
  usersProcessed: number;
  /** Number of personal workspaces created */
  workspacesCreated: number;
  /** Per-user errors that didn't abort the whole migration */
  errors: { userId: string; error: string }[];
}

/**
 * One-time data migration: creates personal workspaces for existing users
 * who don't have a default_workspace_id (FR-011).
 *
 * For each user without a default_workspace_id:
 * 1. Check if a personal workspace already exists
 * 2. If none exists, create one in a transaction (create + set default)
 * 3. If one exists but default wasn't set, update the user
 *
 * Uses console.log for progress since this is a one-time script meant to
 * be run manually or via a migration hook.
 *
 * @param driver - Connected SurrealDriver instance
 * @returns MigrationResult with stats and per-user errors
 */
export async function migrateDefaultWorkspaces(driver: SurrealDriver): Promise<MigrationResult> {
  const result: MigrationResult = {
    usersProcessed: 0,
    workspacesCreated: 0,
    errors: [],
  };

  console.log('[migrate-default-workspaces] Starting migration...');

  let users: Record<string, any>[];

  try {
    users = await driver.select<Record<string, any>>('users');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[migrate-default-workspaces] Failed to query users:', message);
    throw new Error(`Migration failed: ${message}`);
  }

  const usersWithoutDefault = users.filter((u) => u.default_workspace_id == null);

  result.usersProcessed = usersWithoutDefault.length;

  console.log(
    `[migrate-default-workspaces] Found ${users.length} total users, ` +
      `${usersWithoutDefault.length} without default_workspace_id`,
  );

  for (const user of usersWithoutDefault) {
    const userIdStr = user.id instanceof RecordId ? String(user.id) : String(user.id ?? 'unknown');

    console.log(`[migrate-default-workspaces] Processing user ${userIdStr}...`);

    try {
      // Check if a personal workspace already exists for this user
      const existingWorkspaces = await driver.query<Record<string, any>>(
        'SELECT * FROM workspaces WHERE is_personal = true AND user_id = $userId LIMIT 1',
        { userId: user.id },
      );

      if (existingWorkspaces?.[0]) {
        // Personal workspace exists but default wasn't set — just update the user
        const ws = existingWorkspaces[0];
        console.log(
          `[migrate-default-workspaces] Found existing workspace ` +
            `${String(ws.id)} for user ${userIdStr}`,
        );

        await driver.transaction(async (tx) => {
          await tx.query('UPDATE $userId SET default_workspace_id = $workspaceId', {
            userId: user.id,
            workspaceId: ws.id,
          });
        });

        console.log(
          `[migrate-default-workspaces] Set default_workspace_id to ` +
            `${String(ws.id)} for user ${userIdStr}`,
        );
      } else {
        // No personal workspace exists — create one and set default in a transaction
        const displayName = user.name ?? user.email ?? 'Personal Workspace';

        await driver.transaction(async (tx) => {
          const created = await tx.create<Record<string, any>>('workspaces', {
            is_personal: true,
            user_id: user.id,
            name: displayName,
            description: user.email ?? '',
          });

          const workspace = created?.[0];
          if (!workspace) {
            throw new Error('create returned empty result');
          }

          await tx.query('UPDATE $userId SET default_workspace_id = $workspaceId', {
            userId: user.id,
            workspaceId: workspace.id,
          });
        });

        result.workspacesCreated++;

        console.log(
          `[migrate-default-workspaces] Created workspace and set default ` +
            `for user ${userIdStr}`,
        );
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[migrate-default-workspaces] Error processing user ${userIdStr}:`, errorMsg);
      result.errors.push({
        userId: userIdStr,
        error: errorMsg,
      });
    }
  }

  console.log(
    `[migrate-default-workspaces] Migration complete. ` +
      `Users processed: ${result.usersProcessed}, ` +
      `Workspaces created: ${result.workspacesCreated}, ` +
      `Errors: ${result.errors.length}`,
  );

  return result;
}
