import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecordId } from 'surrealdb';

// =============================================================================
// Hoisted mocks
// =============================================================================

const { mockTx, mockDriver } = vi.hoisted(() => {
  const mockTx = {
    query: vi.fn(),
    create: vi.fn(),
  };

  const mockDriver = {
    select: vi.fn(),
    query: vi.fn(),
    transaction: vi.fn(),
  };

  return { mockTx, mockDriver };
});

// =============================================================================
// Module mocks — hoisted before imports
// =============================================================================

vi.mock('@woss/dali-orm', () => ({
  SurrealDriver: class {},
}));

// =============================================================================
// Module under test
// =============================================================================

import { migrateDefaultWorkspaces } from '../migrate-default-workspaces';

// =============================================================================
// Helpers
// =============================================================================

const USER_ID_1 = new RecordId('users', 'u1');
const USER_ID_2 = new RecordId('users', 'u2');
const USER_ID_3 = new RecordId('users', 'u3');
const USER_ID_4 = new RecordId('users', 'u4');

const WORKSPACE_ID_1 = new RecordId('workspaces', 'w1');
const WORKSPACE_ID_2 = new RecordId('workspaces', 'w2');
const WORKSPACE_ID_3 = new RecordId('workspaces', 'w3');

function makeUser(overrides: Record<string, unknown>) {
  return {
    name: 'Test User',
    email: 'test@example.com',
    default_workspace_id: null,
    ...overrides,
  };
}

// =============================================================================
// Setup
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();

  // Wire transaction(fn) to invoke fn(mockTx) so errors flow through
  mockDriver.transaction.mockImplementation((fn: (tx: typeof mockTx) => unknown) => fn(mockTx));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// Tests
// =============================================================================

describe('migrateDefaultWorkspaces', () => {
  // ---------------------------------------------------------------------------
  // Happy path — users without default_workspace_id, no existing workspaces
  // ---------------------------------------------------------------------------

  test('creates personal workspace for each user without default_workspace_id', async () => {
    const users = [
      makeUser({ id: USER_ID_1, name: 'Alice', email: 'alice@example.com' }),
      makeUser({ id: USER_ID_2, name: 'Bob', email: 'bob@example.com' }),
    ];

    mockDriver.select.mockResolvedValue(users);
    // No existing personal workspaces found for either user
    mockDriver.query.mockResolvedValue([]);

    // Each user goes through transaction: create + update
    mockTx.create.mockResolvedValue([{ id: WORKSPACE_ID_1 }]);
    mockTx.query.mockResolvedValue(undefined);

    const result = await migrateDefaultWorkspaces(mockDriver as any);

    expect(result.usersProcessed).toBe(2);
    expect(result.workspacesCreated).toBe(2);
    expect(result.errors).toEqual([]);

    // driver.select should be called with 'users'
    expect(mockDriver.select).toHaveBeenCalledTimes(1);
    expect(mockDriver.select).toHaveBeenCalledWith('users');

    // driver.query for existing workspace check should be called once per user
    expect(mockDriver.query).toHaveBeenCalledTimes(2);
    expect(mockDriver.query).toHaveBeenCalledWith(
      'SELECT * FROM workspaces WHERE is_personal = true AND user_id = $userId LIMIT 1',
      { userId: USER_ID_1 },
    );
    expect(mockDriver.query).toHaveBeenCalledWith(
      'SELECT * FROM workspaces WHERE is_personal = true AND user_id = $userId LIMIT 1',
      { userId: USER_ID_2 },
    );

    // Both users should have a transaction that creates workspace + updates user
    expect(mockDriver.transaction).toHaveBeenCalledTimes(2);
    expect(mockTx.create).toHaveBeenCalledTimes(2);
    expect(mockTx.create).toHaveBeenCalledWith('workspaces', {
      is_personal: true,
      user_id: USER_ID_1,
      name: 'Alice',
      description: 'alice@example.com',
    });
    expect(mockTx.create).toHaveBeenCalledWith('workspaces', {
      is_personal: true,
      user_id: USER_ID_2,
      name: 'Bob',
      description: 'bob@example.com',
    });

    // Each transaction should update the user's default_workspace_id
    expect(mockTx.query).toHaveBeenCalledTimes(2);
    expect(mockTx.query).toHaveBeenCalledWith(
      'UPDATE $userId SET default_workspace_id = $workspaceId',
      { userId: USER_ID_1, workspaceId: WORKSPACE_ID_1 },
    );
    expect(mockTx.query).toHaveBeenCalledWith(
      'UPDATE $userId SET default_workspace_id = $workspaceId',
      { userId: USER_ID_2, workspaceId: WORKSPACE_ID_1 },
    );
  });

  // ---------------------------------------------------------------------------
  // Users with default_workspace_id already set are skipped
  // ---------------------------------------------------------------------------

  test('skips users who already have default_workspace_id', async () => {
    const users = [
      makeUser({ id: USER_ID_1, name: 'Alice', default_workspace_id: WORKSPACE_ID_1 }),
      makeUser({ id: USER_ID_2, name: 'Bob', default_workspace_id: null }),
    ];

    mockDriver.select.mockResolvedValue(users);
    mockDriver.query.mockResolvedValue([]);
    mockTx.create.mockResolvedValue([{ id: WORKSPACE_ID_2 }]);
    mockTx.query.mockResolvedValue(undefined);

    const result = await migrateDefaultWorkspaces(mockDriver as any);

    // Only Bob (without default_workspace_id) should be processed
    expect(result.usersProcessed).toBe(1);
    expect(result.workspacesCreated).toBe(1);
    expect(result.errors).toEqual([]);

    // Only one user should be queried for existing workspace
    expect(mockDriver.query).toHaveBeenCalledTimes(1);
    expect(mockDriver.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM workspaces'),
      { userId: USER_ID_2 },
    );

    // Only one transaction should run
    expect(mockDriver.transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.create).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // Skips users with string id that looks set
  // ---------------------------------------------------------------------------

  test('skips users where default_workspace_id is a string (already set)', async () => {
    const users = [
      makeUser({ id: USER_ID_1, name: 'Alice', default_workspace_id: 'workspaces:w1' }),
      makeUser({ id: USER_ID_2, name: 'Bob', default_workspace_id: null }),
    ];

    mockDriver.select.mockResolvedValue(users);
    mockDriver.query.mockResolvedValue([]);
    mockTx.create.mockResolvedValue([{ id: WORKSPACE_ID_2 }]);
    mockTx.query.mockResolvedValue(undefined);

    const result = await migrateDefaultWorkspaces(mockDriver as any);

    expect(result.usersProcessed).toBe(1);
    expect(result.workspacesCreated).toBe(1);
    expect(mockDriver.transaction).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // Existing personal workspace detection — update only, no create
  // ---------------------------------------------------------------------------

  test('updates user when personal workspace already exists (no new workspace)', async () => {
    const users = [makeUser({ id: USER_ID_1, name: 'Alice' })];

    mockDriver.select.mockResolvedValue(users);
    // Existing workspace found
    mockDriver.query.mockResolvedValue([{ id: WORKSPACE_ID_1 }]);

    // Transaction only does UPDATE (no create)
    mockTx.query.mockResolvedValue(undefined);

    const result = await migrateDefaultWorkspaces(mockDriver as any);

    expect(result.usersProcessed).toBe(1);
    expect(result.workspacesCreated).toBe(0);
    expect(result.errors).toEqual([]);

    // Should have queried for existing workspace
    expect(mockDriver.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM workspaces'),
      { userId: USER_ID_1 },
    );

    // Transaction should run but only with UPDATE query, no CREATE
    expect(mockDriver.transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.create).not.toHaveBeenCalled();
    expect(mockTx.query).toHaveBeenCalledTimes(1);
    expect(mockTx.query).toHaveBeenCalledWith(
      'UPDATE $userId SET default_workspace_id = $workspaceId',
      { userId: USER_ID_1, workspaceId: WORKSPACE_ID_1 },
    );
  });

  // ---------------------------------------------------------------------------
  // Per-user error handling — one failure doesn't abort others
  // ---------------------------------------------------------------------------

  test('continues processing remaining users when one user fails', async () => {
    const users = [
      makeUser({ id: USER_ID_1, name: 'Alice' }),
      makeUser({ id: USER_ID_2, name: 'Bob' }),
      makeUser({ id: USER_ID_3, name: 'Carol' }),
    ];

    mockDriver.select.mockResolvedValue(users);

    // First query (existing workspace check for Alice) fails
    mockDriver.query.mockRejectedValueOnce(new Error('Connection timeout'));
    // Remaining workspace checks succeed
    mockDriver.query.mockResolvedValue([]);
    mockDriver.query.mockResolvedValue([]);

    // Carol's transaction fails
    mockTx.create.mockResolvedValueOnce([{ id: WORKSPACE_ID_1 }]);
    mockTx.query.mockResolvedValueOnce(undefined); // Bob's transaction succeeds
    mockTx.create.mockRejectedValueOnce(new Error('Create failed')); // Carol's fails

    const result = await migrateDefaultWorkspaces(mockDriver as any);

    // All 3 users were processed (even the one that errored)
    expect(result.usersProcessed).toBe(3);
    // Only Bob's workspace was created
    expect(result.workspacesCreated).toBe(1);
    // Two errors: Alice (query check) and Carol (create)
    expect(result.errors).toHaveLength(2);

    const errorUserIds = result.errors.map((e) => e.userId);
    expect(errorUserIds).toContain(String(USER_ID_1));
    expect(errorUserIds).toContain(String(USER_ID_3));

    // Bob's error list should NOT contain an entry
    expect(errorUserIds).not.toContain(String(USER_ID_2));

    // Verify transactions: only Bob should have a successful one
    // Alice failed at driver.query level (before transaction)
    // Bob succeeded
    // Carol failed inside transaction
    expect(mockDriver.transaction).toHaveBeenCalledTimes(2); // Bob + Carol
  });

  // ---------------------------------------------------------------------------
  // Driver.select failure propagates
  // ---------------------------------------------------------------------------

  test('throws error when driver.select fails', async () => {
    mockDriver.select.mockRejectedValue(new Error('Database unreachable'));

    await expect(migrateDefaultWorkspaces(mockDriver as any)).rejects.toThrow(
      'Migration failed: Database unreachable',
    );

    // No further calls should have been made
    expect(mockDriver.query).not.toHaveBeenCalled();
    expect(mockDriver.transaction).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Edge case — user with null name uses email fallback
  // ---------------------------------------------------------------------------

  test('uses email as display name when name is null', async () => {
    const users = [makeUser({ id: USER_ID_1, name: null, email: 'noname@example.com' })];

    mockDriver.select.mockResolvedValue(users);
    mockDriver.query.mockResolvedValue([]);
    mockTx.create.mockResolvedValue([{ id: WORKSPACE_ID_1 }]);
    mockTx.query.mockResolvedValue(undefined);

    const result = await migrateDefaultWorkspaces(mockDriver as any);

    expect(result.usersProcessed).toBe(1);
    expect(result.workspacesCreated).toBe(1);
    expect(result.errors).toEqual([]);

    expect(mockTx.create).toHaveBeenCalledWith('workspaces', {
      is_personal: true,
      user_id: USER_ID_1,
      name: 'noname@example.com',
      description: 'noname@example.com',
    });
  });

  // ---------------------------------------------------------------------------
  // Edge case — user with null name and null email uses "Personal Workspace"
  // ---------------------------------------------------------------------------

  test('uses "Personal Workspace" as fallback when name and email are null', async () => {
    const users = [makeUser({ id: USER_ID_1, name: null, email: null })];

    mockDriver.select.mockResolvedValue(users);
    mockDriver.query.mockResolvedValue([]);
    mockTx.create.mockResolvedValue([{ id: WORKSPACE_ID_1 }]);
    mockTx.query.mockResolvedValue(undefined);

    const result = await migrateDefaultWorkspaces(mockDriver as any);

    expect(result.usersProcessed).toBe(1);
    expect(result.workspacesCreated).toBe(1);

    expect(mockTx.create).toHaveBeenCalledWith('workspaces', {
      is_personal: true,
      user_id: USER_ID_1,
      name: 'Personal Workspace',
      description: '',
    });
  });

  // ---------------------------------------------------------------------------
  // Edge case — user.id is a plain string (not RecordId)
  // ---------------------------------------------------------------------------

  test('handles user.id as plain string', async () => {
    const users = [makeUser({ id: 'users:plain', name: 'Plain', email: 'plain@example.com' })];

    mockDriver.select.mockResolvedValue(users);
    mockDriver.query.mockResolvedValue([]);
    mockTx.create.mockResolvedValue([{ id: WORKSPACE_ID_1 }]);
    mockTx.query.mockResolvedValue(undefined);

    const result = await migrateDefaultWorkspaces(mockDriver as any);

    expect(result.usersProcessed).toBe(1);
    expect(result.workspacesCreated).toBe(1);
    expect(result.errors).toEqual([]);

    // userId in error should be the string form
    expect(mockDriver.query).toHaveBeenCalledWith(
      expect.any(String),
      { userId: 'users:plain' },
    );
  });

  // ---------------------------------------------------------------------------
  // Edge case — empty users array
  // ---------------------------------------------------------------------------

  test('returns zero counts when no users exist', async () => {
    mockDriver.select.mockResolvedValue([]);

    const result = await migrateDefaultWorkspaces(mockDriver as any);

    expect(result.usersProcessed).toBe(0);
    expect(result.workspacesCreated).toBe(0);
    expect(result.errors).toEqual([]);

    expect(mockDriver.query).not.toHaveBeenCalled();
    expect(mockDriver.transaction).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Edge case — all users have default_workspace_id
  // ---------------------------------------------------------------------------

  test('returns zero counts when all users have default_workspace_id', async () => {
    const users = [
      makeUser({ id: USER_ID_1, default_workspace_id: WORKSPACE_ID_1 }),
      makeUser({ id: USER_ID_2, default_workspace_id: WORKSPACE_ID_2 }),
    ];

    mockDriver.select.mockResolvedValue(users);

    const result = await migrateDefaultWorkspaces(mockDriver as any);

    expect(result.usersProcessed).toBe(0);
    expect(result.workspacesCreated).toBe(0);
    expect(result.errors).toEqual([]);

    expect(mockDriver.query).not.toHaveBeenCalled();
    expect(mockDriver.transaction).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Error message extraction for non-Error throws
  // ---------------------------------------------------------------------------

  test('handles non-Error throws inside per-user processing', async () => {
    const users = [makeUser({ id: USER_ID_1, name: 'Alice' })];

    mockDriver.select.mockResolvedValue(users);
    // driver.query check throws a string (not Error)
    mockDriver.query.mockRejectedValue('string error');

    const result = await migrateDefaultWorkspaces(mockDriver as any);

    expect(result.usersProcessed).toBe(1);
    expect(result.workspacesCreated).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toBe('string error');
  });

  // ---------------------------------------------------------------------------
  // Transaction create returns empty result
  // ---------------------------------------------------------------------------

  test('records error when tx.create returns empty result', async () => {
    const users = [makeUser({ id: USER_ID_1, name: 'Alice' })];

    mockDriver.select.mockResolvedValue(users);
    mockDriver.query.mockResolvedValue([]); // No existing workspace
    mockTx.create.mockResolvedValue([]); // Empty result from create

    const result = await migrateDefaultWorkspaces(mockDriver as any);

    expect(result.usersProcessed).toBe(1);
    expect(result.workspacesCreated).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toBe('create returned empty result');
  });
});
