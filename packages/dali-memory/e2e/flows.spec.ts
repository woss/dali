import { test, expect, type Page } from '@playwright/test';
import { spawn } from 'child_process';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_PASS = 'Password123';
const TEST_NAME = 'E2E Flow User';

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Register a fresh user and return email.
 */
async function registerUser(page: Page, name = TEST_NAME, pass = TEST_PASS): Promise<string> {
  const email = `${uid()}@example.com`;
  const uniqueName = `${name}-${uid()}`;
  await page.goto('/register');
  await page.fill('#name', uniqueName);
  await page.fill('#email', email);
  await page.fill('#password', pass);
  await page.fill('#confirm_password', pass);
  await page.click('button:has-text("Create Account")');
  await page.waitForURL('/workspaces');
  return email;
}

/**
 * Login with credentials.
 */
async function login(page: Page, email: string, pass: string): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', pass);
  await page.click('button:has-text("Sign In")');
  await page.waitForURL('/workspaces');
}

/**
 * Create a workspace and return its name.
 */
async function createWorkspace(page: Page, name: string, desc?: string): Promise<void> {
  await page.goto('/workspaces');
  await page.click('button:has-text("+ New Workspace")');
  await page.waitForTimeout(300);
  await page.fill('#modal-name', name);
  if (desc) await page.fill('#modal-desc', desc);
  await page.click('button:has-text("Create Workspace")');
}

/**
 * Navigate into a workspace's memories by clicking its "View →" link.
 */
async function enterWorkspace(page: Page, workspaceName: string): Promise<void> {
  await page.goto('/workspaces');
  await page.locator(`a[href*="/workspaces/"]`).filter({ hasText: 'View →' }).first().click();
  await page.waitForURL(/\/workspaces\/.+\/memories/);
}

/**
 * Create a memory in the current workspace.
 */
async function createMemory(
  page: Page,
  name: string,
  content: string,
  type = 'fact',
): Promise<void> {
  await page.click('button:has-text("+ New Memory")');
  await page.waitForTimeout(300);
  await page.fill('#modal-name', name);
  await page.fill('#modal-content', content);
  if (type !== 'fact') {
    await page.selectOption('#modal-type', type);
  }
  await page.click('button:has-text("Save Memory")');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Workspace CRUD', () => {
  test('create workspace shows in list', async ({ page }) => {
    const wsName = `WS-${uid()}`;
    await registerUser(page);

    await createWorkspace(page, wsName, 'E2E test workspace');
    // Wait for toast
    await expect(
      page.getByRole('alert').filter({ hasText: 'Workspace created' }).first(),
    ).toBeVisible({ timeout: 5000 });
    // Name appears in list
    await expect(page.locator('h3').filter({ hasText: wsName })).toBeVisible();
  });

  test('workspace card has memory count badge', async ({ page }) => {
    const wsName = `WS-${uid()}`;
    await registerUser(page);

    await createWorkspace(page, wsName);
    await expect(page.locator('h3').filter({ hasText: wsName })).toBeVisible();

    // Verify memory count badge exists
    const card = page.locator('h3').filter({ hasText: wsName }).locator('..');
    await expect(card.locator('.badge').filter({ hasText: /memories/i })).toBeVisible();
  });

  test('empty workspace shows empty state', async ({ page }) => {
    await registerUser(page);
    const wsName = `WS-${uid()}`;
    await createWorkspace(page, wsName);

    // Enter workspace via its "View →" link (not the navbar Memories link)
    await page.locator('a[href*="/workspaces/"]').filter({ hasText: 'View →' }).first().click();
    await page.waitForURL(/\/workspaces\/.+\/memories/);
    await expect(page.locator('text=No memories yet in this workspace.')).toBeVisible();
  });

  test('delete workspace removes it from list', async ({ page }) => {
    const wsName = `WS-${uid()}`;
    await registerUser(page);

    await createWorkspace(page, wsName);
    await expect(page.locator('h3').filter({ hasText: wsName })).toBeVisible();

    // Click delete on the workspace card (avoid the hidden dialog Delete button)
    const deleteBtn = page.locator('.card-actions button:has-text("Delete")').first();
    await deleteBtn.click();
    await page.waitForTimeout(300);

    // Confirm delete dialog
    await expect(page.locator('h3:has-text("Delete Workspace")')).toBeVisible();
    await page.locator('dialog[open] button:has-text("Delete")').click();

    // Wait for success
    await expect(
      page.getByRole('alert').filter({ hasText: 'Workspace deleted' }).first(),
    ).toBeVisible({ timeout: 5000 });
    // Verify removed
    await expect(page.locator('h3').filter({ hasText: wsName })).toHaveCount(0, { timeout: 3000 });
  });
});

test.describe('Memory CRUD', () => {
  test('create memory inside workspace', async ({ page }) => {
    await registerUser(page);
    const wsName = `WS-${uid()}`;
    await createWorkspace(page, wsName);

    // Enter workspace memories
    await enterWorkspace(page, wsName);

    const memName = `MEM-${uid()}`;
    await createMemory(page, memName, 'This is the content of the memory.');

    // Wait for toast
    await expect(page.getByRole('alert').filter({ hasText: 'Memory created' }).first()).toBeVisible(
      { timeout: 5000 },
    );
    // Memory name visible in list
    await expect(page.locator('h3').filter({ hasText: memName })).toBeVisible();
    // Content preview visible
    await expect(page.locator('text=This is the content of the memory.')).toBeVisible();
  });

  test('view memory detail page', async ({ page }) => {
    await registerUser(page);
    const wsName = `WS-${uid()}`;
    await createWorkspace(page, wsName);
    await enterWorkspace(page, wsName);

    const memName = `MEM-${uid()}`;
    await createMemory(page, memName, 'Detail page content');
    await expect(page.getByRole('alert').filter({ hasText: 'Memory created' }).first()).toBeVisible(
      { timeout: 5000 },
    );

    // Click memory name link to go to detail
    await page.locator('a[href*="/memories/"]').filter({ hasText: memName }).click();
    await page.waitForURL(/\/memories\/[^/]+$/);

    // Verify detail page
    await expect(page.locator('h1').filter({ hasText: memName })).toBeVisible();
    await expect(page.locator('text=Detail page content')).toBeVisible();
    // Back link present
    await expect(page.locator('a:has-text("Back to Workspace")')).toBeVisible();
  });

  test('delete memory from workspace list with daisyUI dialog', async ({ page }) => {
    await registerUser(page);
    const wsName = `WS-${uid()}`;
    await createWorkspace(page, wsName);
    await enterWorkspace(page, wsName);

    const memName = `MEM-${uid()}`;
    await createMemory(page, memName, 'Delete test content');
    await expect(page.getByRole('alert').filter({ hasText: 'Memory created' }).first()).toBeVisible(
      { timeout: 5000 },
    );
    await expect(page.locator('h3').filter({ hasText: memName })).toBeVisible();

    // Click the card delete button (dialog comes first in DOM, so use data-tip selector)
    const deleteBtn = page.locator('[data-tip="Delete this memory permanently"]').first();
    await deleteBtn.click();
    await page.waitForTimeout(300);

    // Verify dialog opened
    await expect(page.locator('h3:has-text("Delete Memory")')).toBeVisible();
    await expect(page.locator('text=This action cannot be undone.')).toBeVisible();
    // Has Cancel button
    await expect(page.locator('dialog[open] button:has-text("Cancel")')).toBeVisible();
    // Delete in dialog
    await page.locator('dialog[open] button:has-text("Delete")').click();

    // Verify toast
    await expect(page.getByRole('alert').filter({ hasText: 'Memory deleted' }).first()).toBeVisible(
      { timeout: 5000 },
    );
  });

  test('delete memory from detail page with daisyUI dialog', async ({ page }) => {
    await registerUser(page);
    const wsName = `WS-${uid()}`;
    await createWorkspace(page, wsName);
    await enterWorkspace(page, wsName);

    const memName = `MEM-${uid()}`;
    await createMemory(page, memName, 'Detail delete test');
    await expect(page.getByRole('alert').filter({ hasText: 'Memory created' }).first()).toBeVisible(
      { timeout: 5000 },
    );

    // Go to detail
    await page.locator('a[href*="/memories/"]').filter({ hasText: memName }).click();
    await page.waitForURL(/\/memories\/[^/]+$/);

    // Click Delete button on detail page
    await page.locator('button:has-text("Delete")').click();
    await page.waitForTimeout(300);

    // Verify delete dialog
    await expect(page.locator('h3:has-text("Delete Memory")')).toBeVisible();
    await expect(page.locator(`strong:has-text("${memName}")`)).toBeVisible();
    await expect(page.locator('text=This action cannot be undone.')).toBeVisible();

    // Confirm delete
    await page.locator('dialog[open] button:has-text("Delete")').click();

    // Verify redirect back to workspace memories
    await page.waitForURL(/\/workspaces\/.+\/memories/, { timeout: 10000 });
    await expect(page.getByRole('alert').filter({ hasText: 'Memory deleted' }).first()).toBeVisible(
      { timeout: 5000 },
    );
  });

  test('memory type selector works in create dialog', async ({ page }) => {
    await registerUser(page);
    const wsName = `WS-${uid()}`;
    await createWorkspace(page, wsName);
    await enterWorkspace(page, wsName);

    // Open create dialog, verify type options
    await page.click('button:has-text("+ New Memory")');
    await page.waitForTimeout(300);

    // <option> elements are always hidden — check the <select> has all option text
    await expect(page.locator('#modal-type')).toContainText(['Fact', 'Note', 'Code', 'Config']);

    // Select "note" type
    await page.selectOption('#modal-type', 'note');
    await page.fill('#modal-name', `MEM-${uid()}`);
    await page.fill('#modal-content', 'Typed memory');
    await page.click('button:has-text("Save Memory")');
    await expect(page.getByRole('alert').filter({ hasText: 'Memory created' }).first()).toBeVisible(
      { timeout: 5000 },
    );
  });
});

test.describe('Memory Search', () => {
  test('search input is present and functional', async ({ page }) => {
    await registerUser(page);
    const wsName = `WS-${uid()}`;
    await createWorkspace(page, wsName);
    await enterWorkspace(page, wsName);

    // Search input visible with placeholder
    await expect(page.locator('input[placeholder="Search memories..."]')).toBeVisible();
    // Search button visible
    await expect(page.locator('button:has-text("Search")')).toBeVisible();
  });

  test('search shows no results for nonexistent term', async ({ page }) => {
    await registerUser(page);
    const wsName = `WS-${uid()}`;
    await createWorkspace(page, wsName);
    await enterWorkspace(page, wsName);

    // Type in search and hit the search button
    await page.fill('input[placeholder="Search memories..."]', 'NONEXISTENT_ZZZ');
    await page.click('button:has-text("Search")');
    // Should show no results
    await expect(page.locator('text=No results found for').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Navigation', () => {
  test('settings page accessible from navbar', async ({ page }) => {
    await registerUser(page);
    await page.goto('/settings');
    await expect(page.locator('h1')).toContainText('Settings');
    await expect(page.locator('text=Profile')).toBeVisible();
    await expect(page.locator('text=API Keys')).toBeVisible();
  });

  test('all memories page accessible', async ({ page }) => {
    await registerUser(page);
    await page.goto('/memories');
    await expect(page.locator('h1')).toContainText('All Memories');
  });

  test('home page redirects when authenticated', async ({ page }) => {
    await registerUser(page);
    await page.goto('/');
    // Should see the app nav still (authenticated)
    await expect(page.locator('h1')).toBeVisible();
  });
});

test.describe('Keyboard Shortcut', () => {
  test('Cmd+K focuses search input on memories page', async ({ page }) => {
    await registerUser(page);
    const wsName = `WS-${uid()}`;
    await createWorkspace(page, wsName);
    await enterWorkspace(page, wsName);

    // Focus elsewhere first
    await page.locator('h1').click();
    await page.waitForTimeout(100);

    // Press Cmd+K
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(200);

    // Search input should be focused
    const searchInput = page.locator('input[placeholder="Search memories..."]');
    await expect(searchInput).toBeFocused();
  });
});

test.describe('Mobile Navigation', () => {
  test('hamburger menu toggles nav links on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await registerUser(page);

    // Layout uses daisyUI dropdown, not drawer — hamburger button with .dropdown-content
    const hamburger = page.locator('button[aria-label="Menu"]');
    await expect(hamburger).toBeVisible();

    // Click hamburger to open dropdown
    await hamburger.focus();
    // daisyUI dropdown uses :focus-within — trigger programmatic click then focus
    await hamburger.click();
    await page.waitForTimeout(500);

    // Dropdown content should be visible and have nav links
    await expect(page.locator('.dropdown-content a[href="/workspaces"]')).toBeVisible();
    await expect(page.locator('.dropdown-content a[href="/memories"]')).toBeVisible();
    await expect(page.locator('.dropdown-content a[href="/settings"]')).toBeVisible();
  });
});

test.describe('MCP API via Generated API Key', () => {
  test('generate API key from settings and call MCP endpoints', async ({ page }) => {
    // Register user
    const email = await registerUser(page);

    // Go to settings and generate an API key
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'API Keys' })).toBeVisible();

    const keyName = `e2e-test-${uid()}`;
    await page.fill('#key-name', keyName);
    await page.click('button:has-text("Generate")');

    // Extract the generated key from the alert
    const keyAlert = page.getByRole('alert').filter({ hasText: 'API Key Generated' });
    await expect(keyAlert).toBeVisible({ timeout: 5000 });

    const keyText = await keyAlert.locator('code').textContent();
    expect(keyText).toBeTruthy();
    expect(keyText!.length).toBeGreaterThan(10);

    // ------------------------------------------------------------------
    // Now use this API key to test the MCP SSE endpoint
    // ------------------------------------------------------------------

    // Step 1: Create a workspace first via UI so there's data in the system
    const wsName = `MCP-WS-${uid()}`;
    await page.goto('/workspaces');
    await page.click('button:has-text("+ New Workspace")');
    await page.waitForTimeout(300);
    await page.fill('#modal-name', wsName);
    await page.click('button:has-text("Create Workspace")');
    await expect(
      page.getByRole('alert').filter({ hasText: 'Workspace created' }).first(),
    ).toBeVisible({ timeout: 5000 });

    // Get workspace slug from the URL
    const wsUrl = page.url(); // Should be /workspaces
    const wsLink = page.locator(`a[href*="/workspaces/"]`).filter({ hasText: 'View →' }).first();
    const href = await wsLink.getAttribute('href');
    const workspaceId = href?.replace('/workspaces/', '').replace('/memories', '') || '';
    expect(workspaceId).toBeTruthy();

    // Step 2: Create a memory via UI
    await page.goto(`/workspaces/${workspaceId}/memories`);
    const memName = `MCP-MEM-${uid()}`;
    await createMemory(page, memName, 'MCP API test memory');
    await expect(page.getByRole('alert').filter({ hasText: 'Memory created' }).first()).toBeVisible(
      { timeout: 7000 },
    );

    // Step 3: Call MCP API via HTTP (SSE stream open + POST JSON-RPC)
    const baseUrl = 'http://localhost:7777';

    // Open SSE connection
    const sseResponse = await page.request.get(`${baseUrl}/api/mcp`, {
      headers: { Authorization: `Bearer ${keyText}` },
    });
    expect(sseResponse.ok()).toBe(true);
    expect(sseResponse.headers()['content-type']).toContain('text/event-stream');

    // Read the SSE body to extract sessionId from the endpoint event
    const sseBody = await sseResponse.text();

    // Parse sessionId from event: endpoint\ndata: /api/mcp?sessionId=xxx
    const sessionIdMatch = sseBody.match(/sessionId=([a-f0-9-]+)/);
    expect(sessionIdMatch).not.toBeNull();
    const sessionId = sessionIdMatch![1];

    // Step 4: Call MCP tools_list
    const listResponse = await page.request.post(`${baseUrl}/api/mcp?sessionId=${sessionId}`, {
      headers: {
        Authorization: `Bearer ${keyText}`,
        'Content-Type': 'application/json',
      },
      data: {
        jsonrpc: '2.0',
        id: '1',
        method: 'tools/list',
      },
    });
    expect(listResponse.ok()).toBe(true);

    // Step 5: Call MCP workspaces_list
    const wsListResponse = await page.request.post(`${baseUrl}/api/mcp?sessionId=${sessionId}`, {
      headers: {
        Authorization: `Bearer ${keyText}`,
        'Content-Type': 'application/json',
      },
      data: {
        jsonrpc: '2.0',
        id: '2',
        method: 'tools/call',
        params: {
          name: 'workspaces_list',
          arguments: {},
        },
      },
    });
    expect(wsListResponse.ok()).toBe(true);

    // Step 6: Call MCP memories_search
    const searchResponse = await page.request.post(`${baseUrl}/api/mcp?sessionId=${sessionId}`, {
      headers: {
        Authorization: `Bearer ${keyText}`,
        'Content-Type': 'application/json',
      },
      data: {
        jsonrpc: '2.0',
        id: '3',
        method: 'tools/call',
        params: {
          name: 'memories_search',
          arguments: {
            query: 'MCP',
            workspace_id: workspaceId,
            limit: 5,
          },
        },
      },
    });
    expect(searchResponse.ok()).toBe(true);
  });

  test('MCP API rejects request without auth', async ({ page }) => {
    const baseUrl = 'http://localhost:7777';
    const response = await page.request.get(`${baseUrl}/api/mcp`);
    // Should be 401 without Bearer token
    expect(response.status()).toBe(401);
  });
});

test.describe('Auth & Session', () => {
  test('logout clears session and redirects to login', async ({ page }) => {
    await registerUser(page);

    // Navigate to a protected route to confirm authenticated
    await page.goto('/workspaces');
    await expect(page.locator('h1')).toContainText('Workspaces');

    // Logout
    await page.goto('/logout');
    await page.waitForURL('/login');

    // Verify protected route now redirects
    await page.goto('/workspaces');
    await page.waitForURL('/login');
  });

  test('session persists across page navigations', async ({ page }) => {
    const email = await registerUser(page);

    // Navigate to different pages
    await page.goto('/workspaces');
    await expect(page.locator('h1')).toContainText('Workspaces');

    await page.goto('/settings');
    await expect(page.locator('h1')).toContainText('Settings');
    await expect(page.locator('#email')).toHaveValue(email);

    await page.goto('/memories');
    await expect(page.locator('h1')).toContainText('All Memories');

    // Still authenticated
    await page.goto('/workspaces');
    await expect(page.locator('h1')).toContainText('Workspaces');
  });
});
