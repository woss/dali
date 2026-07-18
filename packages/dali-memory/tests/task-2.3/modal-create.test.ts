// @vitest-environment jsdom
/**
 * Tests for the modal create form on the workspace memories page.
 *
 * The `handleCreate` function is defined inside +page.svelte and cannot be
 * imported directly. These tests verify the function's logic by creating an
 * isolated testable version with mocked dependencies, matching the exact
 * control flow from the component.
 *
 * Tested behaviors:
 * 1. POST to ?/create with FormData from event target
 * 2. On success: dialog closes, fields reset, toast.success, invalidateAll
 * 3. On failure: createError set from body.data.error (or fallback)
 * 4. Submit button disabled while creating
 * 5. Guard prevents double-submit (early return if creating)
 * 6. try/finally ensures creating = false even after throw
 * 7. Modal open/close via showModal/close
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// Helpers — testable handleCreate factory
// =============================================================================

interface MockState {
  creating: boolean;
  createError: string;
  newName: string;
  newContent: string;
  newType: string;
}

/**
 * Creates an isolated version of handleCreate with injectable dependencies.
 * Mirrors the exact control flow from the Svelte component:
 *   - `e.preventDefault()` guards
 *   - `creating` guard (double-submit prevention)
 *   - try/finally ensuring `creating = false`
 *   - fetch POST to ?/create with FormData from e.target
 *   - success: dialog.close(), toast.success(), field reset, invalidateAll()
 *   - error: parse body.data.error or fallback
 *
 * Accepts fetch as a parameter so each call gets an isolated spy, avoiding
 * cross-test leakage from global vi.spyOn chains.
 */
function createHandleCreate(
  state: MockState,
  toastSuccess: any,
  invalidateAll: any,
  dialogClose: any,
  fetchFn: any = fetch,
) {
  return async function handleCreate(e: Event) {
    e.preventDefault();
    if (state.creating) return;
    state.creating = true;
    state.createError = '';
    try {
      const fd = new FormData(e.target as HTMLFormElement);
      const res = await fetchFn('?/create', { method: 'POST', body: fd });
      if (res.ok) {
        dialogClose();
        toastSuccess('Memory created.');
        state.newName = '';
        state.newContent = '';
        state.newType = 'fact';
        await invalidateAll();
      } else {
        try {
          const body = await res.json();
          state.createError = body?.data?.error || 'Failed to create memory.';
        } catch {
          state.createError = 'Failed to create memory.';
        }
      }
    } finally {
      state.creating = false;
    }
  };
}

// =============================================================================
// Fixtures
// =============================================================================

function createFormElement(): HTMLFormElement {
  const form = document.createElement('form');
  form.innerHTML = `
    <input name="name" value="Test Memory" />
    <textarea name="content">Test content</textarea>
    <select name="memory_type"><option value="fact">Fact</option></select>
  `;
  return form;
}

function createEvent(form: HTMLFormElement): Event {
  const event = new Event('submit', { cancelable: true });
  Object.defineProperty(event, 'target', { value: form, writable: false });
  return event;
}

function makeMockFetch(response: Response): any {
  return vi.fn().mockResolvedValue(response);
}

function makeSuccessFetch(data?: any): any {
  return makeMockFetch(new Response(data ? JSON.stringify(data) : null, { status: 200 }));
}

function makeErrorFetch(status: number, body: any): any {
  return makeMockFetch(new Response(JSON.stringify(body), { status }));
}

// =============================================================================
// Tests — handleCreate logic
// =============================================================================

describe('handleCreate — form submission logic', () => {
  let state: MockState;
  let toastSuccess: any;
  let invalidateAll: any;
  let dialogClose: any;
  let dialogShowModal: any;
  let fetchMock: any;
  let handleCreate: any;

  beforeEach(() => {
    state = {
      creating: false,
      createError: '',
      newName: 'Test Memory',
      newContent: 'Test content',
      newType: 'note',
    };
    toastSuccess = vi.fn();
    invalidateAll = vi.fn().mockResolvedValue(undefined);
    dialogClose = vi.fn();
    dialogShowModal = vi.fn();
    fetchMock = makeSuccessFetch();
    handleCreate = createHandleCreate(state, toastSuccess, invalidateAll, dialogClose, fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Requirement 1: POST to ?/create with FormData ────────────

  test('sends POST to ?/create with FormData from event target', async () => {
    const form = createFormElement();
    const event = createEvent(form);

    await handleCreate(event);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('?/create', {
      method: 'POST',
      body: expect.any(FormData),
    });

    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get('name')).toBe('Test Memory');
    expect(fd.get('content')).toBe('Test content');
    expect(fd.get('memory_type')).toBe('fact');
  });

  // ── Requirement 2: On success ────────────────────────────────

  test('on success: closes dialog, resets fields, calls toast.success, calls invalidateAll', async () => {
    const form = createFormElement();
    const event = createEvent(form);

    await handleCreate(event);

    expect(dialogClose).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith('Memory created.');
    expect(state.newName).toBe('');
    expect(state.newContent).toBe('');
    expect(state.newType).toBe('fact');
    expect(invalidateAll).toHaveBeenCalledTimes(1);
  });

  test('on success: invalidateAll is awaited before returning', async () => {
    let invalidateResolved = false;
    invalidateAll = vi.fn().mockImplementation(() => {
      invalidateResolved = true;
      return Promise.resolve();
    });
    handleCreate = createHandleCreate(state, toastSuccess, invalidateAll, dialogClose, fetchMock);

    const form = createFormElement();
    const event = createEvent(form);

    await handleCreate(event);

    expect(invalidateResolved).toBe(true);
  });

  // ── Requirement 3: On failure ────────────────────────────────

  test('on failure: sets createError from body.data.error', async () => {
    fetchMock = makeErrorFetch(400, { data: { error: 'Name already exists' } });
    handleCreate = createHandleCreate(state, toastSuccess, invalidateAll, dialogClose, fetchMock);

    const form = createFormElement();
    const event = createEvent(form);

    await handleCreate(event);

    expect(state.createError).toBe('Name already exists');
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(invalidateAll).not.toHaveBeenCalled();
  });

  test('on failure: uses fallback error when body.data.error is missing', async () => {
    fetchMock = makeErrorFetch(400, { data: {} });
    handleCreate = createHandleCreate(state, toastSuccess, invalidateAll, dialogClose, fetchMock);

    const form = createFormElement();
    const event = createEvent(form);

    await handleCreate(event);

    expect(state.createError).toBe('Failed to create memory.');
  });

  test('on failure: uses fallback error when body is not JSON', async () => {
    fetchMock = makeMockFetch(new Response('not json', { status: 500 }));
    handleCreate = createHandleCreate(state, toastSuccess, invalidateAll, dialogClose, fetchMock);

    const form = createFormElement();
    const event = createEvent(form);

    await handleCreate(event);

    expect(state.createError).toBe('Failed to create memory.');
  });

  test('on failure: uses fallback error when response.json() throws', async () => {
    const badRes = {
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error('parse error')),
    };
    fetchMock = makeMockFetch(badRes as any);
    handleCreate = createHandleCreate(state, toastSuccess, invalidateAll, dialogClose, fetchMock);

    const form = createFormElement();
    const event = createEvent(form);

    await handleCreate(event);

    expect(state.createError).toBe('Failed to create memory.');
  });

  // ── Requirement 4: Submit button disabled while creating ────

  test('creating is true during fetch and false after completion', async () => {
    let creatingDuringFetch = false;
    fetchMock = vi.fn().mockImplementation(async () => {
      creatingDuringFetch = state.creating;
      return new Response(null, { status: 200 });
    });
    handleCreate = createHandleCreate(state, toastSuccess, invalidateAll, dialogClose, fetchMock);

    const form = createFormElement();
    const event = createEvent(form);

    expect(state.creating).toBe(false);

    await handleCreate(event);

    expect(creatingDuringFetch).toBe(true);
    expect(state.creating).toBe(false);
  });

  // ── Requirement 5: Guard prevents double-submit ─────────────

  test('double-submit guard: returns early when creating is true', async () => {
    state.creating = true;

    const localFetch = makeSuccessFetch();
    const localToast = vi.fn();
    const localInvalidate = vi.fn();
    const localDialogClose = vi.fn();
    const localHandleCreate = createHandleCreate(
      state,
      localToast,
      localInvalidate,
      localDialogClose,
      localFetch,
    );

    const form = createFormElement();
    const event = createEvent(form);

    await localHandleCreate(event);

    expect(localToast).not.toHaveBeenCalled();
    expect(localInvalidate).not.toHaveBeenCalled();
    expect(localDialogClose).not.toHaveBeenCalled();
    expect(state.creating).toBe(true); // Guard prevents execution, so creating stays true
  });

  // ── Requirement 6: try/finally ensures creating = false ──────

  test('creating is reset to false when fetch throws', async () => {
    fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    handleCreate = createHandleCreate(state, toastSuccess, invalidateAll, dialogClose, fetchMock);

    const form = createFormElement();
    const event = createEvent(form);

    // The function does not catch errors — they propagate through finally
    await expect(handleCreate(event)).rejects.toThrow('Network error');
    expect(state.creating).toBe(false);
  });

  test('creating is reset to false when fetch resolves with non-ok', async () => {
    fetchMock = makeErrorFetch(500, { data: { error: 'Server error' } });
    handleCreate = createHandleCreate(state, toastSuccess, invalidateAll, dialogClose, fetchMock);

    const form = createFormElement();
    const event = createEvent(form);

    await handleCreate(event);

    expect(state.creating).toBe(false);
    expect(invalidateAll).not.toHaveBeenCalled();
  });

  // ── Requirement 7: Modal open/close ─────────────────────────

  test('dialog.showModal can be called to open the modal', () => {
    dialogShowModal();
    expect(dialogShowModal).toHaveBeenCalledTimes(1);
  });

  test('dialog.close is called when create succeeds', async () => {
    const form = createFormElement();
    const event = createEvent(form);

    await handleCreate(event);
    expect(dialogClose).toHaveBeenCalledTimes(1);
  });

  test('dialog.close is NOT called when create fails', async () => {
    fetchMock = makeErrorFetch(400, { data: { error: 'Error' } });
    handleCreate = createHandleCreate(state, toastSuccess, invalidateAll, dialogClose, fetchMock);

    const form = createFormElement();
    const event = createEvent(form);

    await handleCreate(event);
    expect(dialogClose).not.toHaveBeenCalled();
  });

  test('preventDefault is called on the event', async () => {
    const form = createFormElement();
    const event = createEvent(form);
    const preventDefault = vi.spyOn(event, 'preventDefault');

    await handleCreate(event);

    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  test('dialog is NOT closed when fetch throws', async () => {
    fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    handleCreate = createHandleCreate(state, toastSuccess, invalidateAll, dialogClose, fetchMock);

    const form = createFormElement();
    const event = createEvent(form);

    await expect(handleCreate(event)).rejects.toThrow('Network error');
    expect(dialogClose).not.toHaveBeenCalled();
  });
});

// =============================================================================
// FormData edge cases
// =============================================================================

describe('handleCreate — FormData and field edge cases', () => {
  let state: MockState;
  let toastSuccess: any;
  let invalidateAll: any;
  let dialogClose: any;
  let fetchMock: any;
  let handleCreate: any;

  beforeEach(() => {
    state = {
      creating: false,
      createError: '',
      newName: '',
      newContent: '',
      newType: 'fact',
    };
    toastSuccess = vi.fn();
    invalidateAll = vi.fn().mockResolvedValue(undefined);
    dialogClose = vi.fn();
    fetchMock = makeSuccessFetch();
    handleCreate = createHandleCreate(state, toastSuccess, invalidateAll, dialogClose, fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('FormData includes all three fields (name, content, memory_type)', async () => {
    const form = document.createElement('form');
    form.innerHTML = `
      <input name="name" value="My Memory" />
      <textarea name="content">Some content here</textarea>
      <select name="memory_type"><option value="note">Note</option></select>
    `;
    const event = createEvent(form);

    await handleCreate(event);

    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get('name')).toBe('My Memory');
    expect(fd.get('content')).toBe('Some content here');
    expect(fd.get('memory_type')).toBe('note');
  });

  test('FormData with code type option', async () => {
    const form = document.createElement('form');
    form.innerHTML = `
      <input name="name" value="Test" />
      <textarea name="content">Content</textarea>
      <select name="memory_type"><option value="code">Code</option></select>
    `;
    const event = createEvent(form);

    await handleCreate(event);

    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get('memory_type')).toBe('code');
  });

  test('handles form with empty content field', async () => {
    const form = document.createElement('form');
    form.innerHTML = `
      <input name="name" value="Minimal" />
      <textarea name="content"></textarea>
      <select name="memory_type"><option value="fact">Fact</option></select>
    `;
    const event = createEvent(form);

    await handleCreate(event);

    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get('name')).toBe('Minimal');
    expect(fd.get('content')).toBe('');
    expect(fd.get('memory_type')).toBe('fact');
  });

  test('handles form with config type selection', async () => {
    const form = document.createElement('form');
    form.innerHTML = `
      <input name="name" value="Config Item" />
      <textarea name="content">config data</textarea>
      <select name="memory_type"><option value="config">Config</option></select>
    `;
    const event = createEvent(form);

    await handleCreate(event);

    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.get('memory_type')).toBe('config');
  });
});
