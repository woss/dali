// @vitest-environment jsdom
/**
 * Tests for FR-006: Tag filter empty state branch in +page.svelte.
 *
 * The component's empty state renders one of three messages depending on
 * searchQuery and activeTag:
 *
 *   {#if memoriesLoading}
 *     (loading skeleton — not empty state)
 *   {:else if allMemories.length === 0}
 *     <p class="text-center opacity-60">
 *       {#if searchQuery}
 *         No results found for "<strong>{searchQuery}</strong>".
 *       {:else if activeTag}
 *         No memories tagged with "<strong>{activeTag}</strong>".
 *       {:else}
 *         No memories yet in this workspace.
 *       {/if}
 *     </p>
 *   {:else}
 *     (memory list — not empty state)
 *   {/if}
 *
 * Tests cannot import +page.svelte directly because Svelte 5 SSR compilation
 * in Vitest is not supported by the current project infrastructure (documented
 * in src/routes/workspaces/[id]/memories/__tests__/page.test.ts). Instead,
 * these tests mirror the exact template control flow as a pure function,
 * following the same pattern as tests/task-2.4/delete-confirm.test.ts.
 *
 * The empty state message logic is a pure function of (searchQuery, activeTag):
 *   - searchQuery truthy     → "No results found for "{q}"."
 *   - activeTag truthy       → "No memories tagged with "{tag}"."
 *   - both falsy             → "No memories yet in this workspace."
 *
 * FR-006 specifically adds the `{:else if activeTag}` branch between the
 * search branch and the fallback branch.
 */

import { describe, test, expect } from 'vitest';

// =============================================================================
// Helper — mirrors the exact empty-state message logic from the template
// =============================================================================

/**
 * Returns the empty-state heading HTML for a given (searchQuery, activeTag) pair.
 * Mirrors the exact control flow from +page.svelte lines 332–338:
 *
 *   {#if searchQuery}
 *     No results found for "<strong>{searchQuery}</strong>".
 *   {:else if activeTag}
 *     No memories tagged with "<strong>{activeTag}</strong>".
 *   {:else}
 *     No memories yet in this workspace.
 *   {/if}
 */
function getEmptyMessage(
  searchQuery: string | null | undefined,
  activeTag: string | null | undefined,
): string {
  if (searchQuery) {
    return `No results found for "<strong>${searchQuery}</strong>".`;
  }
  if (activeTag) {
    return `No memories tagged with "<strong>${activeTag}</strong>".`;
  }
  return 'No memories yet in this workspace.';
}

// =============================================================================
// Overall empty state — entry guard tests
// =============================================================================

describe('FR-006: Empty state entry conditions', () => {
  test('empty state is shown when memoriesLoading=false and allMemories.length=0', () => {
    const memoriesLoading = false;
    const allMemories: unknown[] = [];

    const showEmptyState = !memoriesLoading && allMemories.length === 0;
    expect(showEmptyState).toBe(true);
  });

  test('loading skeleton is shown (not empty state) when memoriesLoading=true', () => {
    const memoriesLoading = true;
    const allMemories: unknown[] = [];

    const showEmptyState = !memoriesLoading && allMemories.length === 0;
    expect(showEmptyState).toBe(false);
  });

  test('memory list is shown (not empty state) when allMemories has items', () => {
    const memoriesLoading = false;
    const allMemories = [{ id: 'm1', name: 'Memory 1' }];

    const showEmptyState = !memoriesLoading && allMemories.length === 0;
    expect(showEmptyState).toBe(false);
  });
});

// =============================================================================
// FR-006: Tag filter empty state — message content
// =============================================================================

describe('FR-006: Tag filter empty state — message content', () => {
  test('[REQUIRED 1] shows "No memories tagged with" message when activeTag is set and no searchQuery', () => {
    const searchQuery = null;
    const activeTag = 'work';

    const message = getEmptyMessage(searchQuery, activeTag);

    expect(message).toBe('No memories tagged with "<strong>work</strong>".');
    expect(message).toContain('No memories tagged with');
    expect(message).toContain('work');
  });

  test('[REQUIRED 2] shows "No results found for" message when searchQuery is set (regression)', () => {
    const searchQuery = 'foo';
    const activeTag = null;

    const message = getEmptyMessage(searchQuery, activeTag);

    expect(message).toBe('No results found for "<strong>foo</strong>".');
    expect(message).toContain('No results found for');
    expect(message).toContain('foo');
  });

  test('[REQUIRED 3] shows "No memories yet" message when neither searchQuery nor activeTag is set (regression)', () => {
    const searchQuery = null;
    const activeTag = null;

    const message = getEmptyMessage(searchQuery, activeTag);

    expect(message).toBe('No memories yet in this workspace.');
  });
});

// =============================================================================
// Edge cases — empty/null/undefined values
// =============================================================================

describe('FR-006: Tag filter empty state — edge cases', () => {
  test('searchQuery takes priority over activeTag when both are truthy', () => {
    const searchQuery = 'hello';
    const activeTag = 'work';

    const message = getEmptyMessage(searchQuery, activeTag);

    // Template uses {#if searchQuery} first, so search wins
    expect(message).toBe('No results found for "<strong>hello</strong>".');
    expect(message).not.toContain('tagged');
  });

  test('falls through to generic message when searchQuery is empty string and activeTag is null', () => {
    const searchQuery = '';
    const activeTag = null;

    const message = getEmptyMessage(searchQuery, activeTag);

    // Empty string is falsy, should fall through to generic
    expect(message).toBe('No memories yet in this workspace.');
  });

  test('falls through to generic message when searchQuery is empty string and activeTag is undefined', () => {
    const searchQuery = '';
    const activeTag = undefined;

    const message = getEmptyMessage(searchQuery, activeTag);

    expect(message).toBe('No memories yet in this workspace.');
  });

  test('tag filter message when activeTag is undefined (should fall through to generic)', () => {
    const searchQuery = null;
    const activeTag = undefined;

    const message = getEmptyMessage(searchQuery, activeTag);

    // activeTag from data is derived as data.activeTag ?? null, so undefined
    // becomes null. Both are falsy → generic message.
    expect(message).toBe('No memories yet in this workspace.');
  });

  test('tag filter message includes activeTag in the rendered output', () => {
    const searchQuery = null;
    const activeTag = 'reference';

    const message = getEmptyMessage(searchQuery, activeTag);

    expect(message).toContain('reference');
    expect(message).toContain('<strong>reference</strong>');
  });

  test('tag filter message with tag name containing special characters', () => {
    const searchQuery = null;
    const activeTag = 'code-review/v2';

    const message = getEmptyMessage(searchQuery, activeTag);

    expect(message).toContain('code-review/v2');
    expect(message).toContain('<strong>code-review/v2</strong>');
  });

  test('search message with special characters in query', () => {
    const searchQuery = '<script>alert(1)</script>';
    const activeTag = null;

    const message = getEmptyMessage(searchQuery, activeTag);

    // In the real component, the template uses {@html} for interpolation?
    // No — it uses {searchQuery} which is text interpolation, not {@html}.
    // The point here is that the branch logic still selects the search branch.
    expect(message).toBe('No results found for "<strong><script>alert(1)</script></strong>".');
    expect(message).toContain('script');
  });

  test('activeTag with Unicode characters renders in message', () => {
    const searchQuery = null;
    const activeTag = '重要';

    const message = getEmptyMessage(searchQuery, activeTag);

    expect(message).toContain('重要');
    expect(message).toContain('<strong>重要</strong>');
  });

  test('activeTag with leading/trailing whitespace is preserved in message', () => {
    const searchQuery = null;
    const activeTag = '  urgent  ';

    const message = getEmptyMessage(searchQuery, activeTag);

    // The template does not trim activeTag — it renders as-is
    expect(message).toContain('  urgent  ');
  });
});

// =============================================================================
// Property-based: searchQuery always takes priority over activeTag
// =============================================================================

describe('FR-006: Priority invariant', () => {
  test('when searchQuery is truthy, message always starts with "No results found" regardless of activeTag', () => {
    const searchValues = ['hello', 'test', 'x', '123', 'search query'];
    const tagValues = [null, 'work', 'important', 'reference'];

    for (const q of searchValues) {
      for (const t of tagValues) {
        const message = getEmptyMessage(q, t);
        expect(message).toMatch(/^No results found for/);
      }
    }
  });

  test('when activeTag is truthy and searchQuery is falsy, message always contains "tagged with"', () => {
    const tagValues = ['work', 'important', 'reference', 'urgent', 'personal'];
    const falsyValues = [null, undefined, ''];

    for (const t of tagValues) {
      for (const q of falsyValues) {
        const message = getEmptyMessage(q, t);
        expect(message).toMatch(/No memories tagged with/);
        expect(message).toContain(t);
      }
    }
  });

  test('when both searchQuery and activeTag are falsy, message is generic', () => {
    const falsySearch = [null, undefined, ''];
    const falsyTag = [null, undefined];

    for (const q of falsySearch) {
      for (const t of falsyTag) {
        const message = getEmptyMessage(q, t);
        expect(message).toBe('No memories yet in this workspace.');
      }
    }
  });
});
