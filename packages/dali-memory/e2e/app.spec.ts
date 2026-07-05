import { test, expect, type Page } from '@playwright/test';

const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASS = 'Password123';
const TEST_NAME = 'Test User';

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Register a fresh user and return their email.
 * Each call creates a unique user, avoiding shared-state issues.
 */
async function registerUser(page: Page, name: string, pass: string): Promise<string> {
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
 * Register a user with a specific email (not auto-generated).
 */
async function registerUserWithEmail(
  page: Page,
  name: string,
  pass: string,
  email: string,
): Promise<void> {
  const uniqueName = `${name}-${uid()}`;
  await page.goto('/register');
  await page.fill('#name', uniqueName);
  await page.fill('#email', email);
  await page.fill('#password', pass);
  await page.fill('#confirm_password', pass);
  await page.click('button:has-text("Create Account")');
  await page.waitForURL('/workspaces');
}

/**
 * Log in with given credentials and wait for redirect to /memories.
 * Returns true on success, false on failure.
 */
async function login(page: Page, email: string, pass: string): Promise<boolean> {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', pass);
  await page.click('button:has-text("Sign In")');
  try {
    await page.waitForURL('/workspaces', { timeout: 8000 });
    return true;
  } catch {
    return false;
  }
}

test.describe('dali-memory Web UI', () => {
  test('unauthenticated root page renders', async ({ page }) => {
    // Root page is public — does NOT redirect to /login
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('dali-memory');
  });

  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('dali-memory');
    await expect(page.locator('text=Sign in with your email')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
    // Use first() to match only the nav/hero link, not mobile menu dup
    await expect(
      page.locator('main a[href="/register"], .card-body a[href="/register"]').first(),
    ).toBeVisible();
  });

  test('register page renders', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('h1')).toContainText('dali-memory');
    await expect(page.locator('text=Create an account')).toBeVisible();
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirm_password')).toBeVisible();
    await expect(page.locator('button:has-text("Create Account")')).toBeVisible();
    await expect(
      page.locator('main a[href="/login"], .card-body a[href="/login"]').first(),
    ).toBeVisible();
  });

  test('login with invalid creds shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'nobody@example.com');
    await page.fill('#password', 'wrongpassword');
    await page.click('button:has-text("Sign In")');
    await expect(page.locator('[role="alert"]')).toContainText('Invalid email or password');
  });

  test('register a new user', async ({ page }) => {
    await registerUser(page, TEST_NAME, TEST_PASS);
    await expect(page.locator('h1')).toContainText('Workspaces');
  });

  test('register with duplicate email shows error', async ({ page }) => {
    const testEmail = `${uid()}@example.com`;
    const testName = `${TEST_NAME}-${uid()}`;
    // First registration creates the user
    await registerUserWithEmail(page, testName, TEST_PASS, testEmail);
    // Second registration with same email but different name should fail (duplicate email)
    const dupName = `${TEST_NAME}-${uid()}`;
    await page.goto('/register');
    await page.fill('#name', dupName);
    await page.fill('#email', testEmail);
    await page.fill('#password', TEST_PASS);
    await page.fill('#confirm_password', TEST_PASS);
    await page.click('button:has-text("Create Account")');
    await expect(page.locator('[role="alert"]')).toContainText('email already exists');
  });

  test('protected routes redirect to /login when not authenticated', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/settings');
    await page.waitForURL('/login');
  });

  test('login with registered user and view settings', async ({ page }) => {
    // Register a dedicated user for this test to avoid shared-state issues
    const email = await registerUser(page, TEST_NAME, TEST_PASS);
    await expect(page.locator('h1')).toContainText('Workspaces');

    // Navigate to settings
    await page.goto('/settings');
    await expect(page.locator('h1')).toContainText('Settings');
    await expect(page.locator('text=Profile')).toBeVisible();
    // Name includes a unique suffix from registerUser, just verify it's populated
    await expect(page.locator('#name')).not.toBeEmpty();
    await expect(page.locator('#email')).toHaveValue(email);
  });

  test('settings - update profile', async ({ page }) => {
    // Register a dedicated user for this test
    const email = await registerUser(page, TEST_NAME, TEST_PASS);

    // Go to settings
    await page.goto('/settings');
    const updatedName = TEST_NAME + ' Updated';
    await page.fill('#name', updatedName);
    await page.click('button:has-text("Save")');
    // Should see success message
    await expect(
      page.getByRole('alert').filter({ hasText: 'Profile updated' }).first(),
    ).toBeVisible();
  });

  test('settings - generate and revoke API key', async ({ page }) => {
    // Register a dedicated user for this test
    await registerUser(page, TEST_NAME, TEST_PASS);

    // Go to settings
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'API Keys' })).toBeVisible();

    // Generate a key
    await page.fill('#key-name', 'playwright-test-key');
    await page.click('button:has-text("Generate")');
    // Should see the generated key notification
    const keyAlert = page.getByRole('alert').filter({ hasText: 'API Key Generated' });
    await expect(keyAlert).toBeVisible();

    // Extract the API key value
    const keyText = await keyAlert.locator('code').textContent();
    expect(keyText).toBeTruthy();
    expect(keyText!.length).toBeGreaterThan(10);

    // Key format: hex-hex (two UUIDs separated by dash)
    expect(keyText).toMatch(/^[a-f0-9-]+$/);

    // Revoke the key
    page.once('dialog', (dialog) => dialog.accept());
    await page.click('button:has-text("Revoke")');
    await page.waitForTimeout(500);
  });

  test('register with password mismatch shows error', async ({ page }) => {
    await page.goto('/register');
    await page.fill('#name', 'Mismatch User');
    await page.fill('#email', 'mismatch@example.com');
    await page.fill('#password', TEST_PASS);
    await page.fill('#confirm_password', 'differentpass');
    await page.click('button:has-text("Create Account")');
    await expect(page.locator('[role="alert"]')).toContainText('Passwords do not match');
  });

  test('register with short password shows error', async ({ page }) => {
    await page.goto('/register');
    // Bypass HTML5 minlength validation so we can test server-side validation
    await page.locator('#password').evaluate((el) => el.removeAttribute('minlength'));
    await page.fill('#name', 'Short Pass');
    await page.fill('#email', 'short@example.com');
    await page.fill('#password', '1234567');
    await page.fill('#confirm_password', '1234567');
    await page.click('button:has-text("Create Account")');
    await expect(page.locator('[role="alert"]')).toContainText('at least 8 characters');
  });

  test('memories page shows memories', async ({ page }) => {
    // Register and auto-login
    await registerUser(page, TEST_NAME, TEST_PASS);

    // Click the first workspace card to enter workspace memories
    await page.locator('a[href*="/workspaces/"]').first().click();
    await expect(page.locator('h1')).toContainText('Memories');
    // Should show search or memory list
    await expect(page.locator('text=No memories yet in this workspace.')).toBeVisible();
  });
});
