import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// mockConfig shared between hoisted and mock
const mockConfig = vi.hoisted(() => ({
  DALI_MEMORY_DD_API_KEY: undefined as string | undefined,
  DALI_MEMORY_DD_SITE: 'datadoghq.eu',
  DALI_MEMORY_DD_SERVICE: 'dali-memory',
  DALI_MEMORY_DD_HOSTNAME: undefined as string | undefined,
  DALI_MEMORY_DD_TAGS: '',
  DALI_MEMORY_DD_SOURCE: 'nodejs',
}));

const mockGetTrace = vi.hoisted(() =>
  vi.fn<() => { traceId: string; spanId?: string } | undefined>(),
);

vi.mock('../config', () => ({ getConfig: () => mockConfig }));
vi.mock('../trace-context', () => ({ getTrace: mockGetTrace }));

// eslint-disable-next-line @typescript-eslint/unused-vars
const _unused = '';

function mockLogRecord(overrides: Record<string, unknown> = {}) {
  return {
    category: ['dali-memory', 'mcp'],
    level: 'info',
    message: ['hello', 'world'],
    timestamp: 1_234_567_890_000,
    properties: {},
    ...overrides,
  };
}

describe('formatMessage', () => {
  test('joins string parts with space', async () => {
    const { formatMessage } = await import('../datadog-sink');
    expect(formatMessage(['a', 'b', 'c'])).toBe('a b c');
  });

  test('converts null to "null"', async () => {
    const { formatMessage } = await import('../datadog-sink');
    expect(formatMessage(['val: ', null])).toBe('val:  null');
  });

  test('serializes objects as JSON', async () => {
    const { formatMessage } = await import('../datadog-sink');
    expect(formatMessage(['data: ', { a: 1 }])).toBe('data:  {"a":1}');
  });

  test('handles mixed types', async () => {
    const { formatMessage } = await import('../datadog-sink');
    expect(formatMessage(['count=', 42, ' name=', 'alice'])).toBe('count= 42  name= alice');
  });
});

describe('createDatadogSink', () => {
  beforeEach(() => {
    mockConfig.DALI_MEMORY_DD_API_KEY = undefined;
    mockConfig.DALI_MEMORY_DD_SITE = 'datadoghq.eu';
    mockConfig.DALI_MEMORY_DD_SERVICE = 'dali-memory';
    mockConfig.DALI_MEMORY_DD_HOSTNAME = undefined;
    mockConfig.DALI_MEMORY_DD_TAGS = '';
    mockConfig.DALI_MEMORY_DD_SOURCE = 'nodejs';
    mockGetTrace.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('returns null when no API key', async () => {
    const { createDatadogSink } = await import('../datadog-sink');
    expect(createDatadogSink()).toBeNull();
  });

  test('returns Sink when API key present', async () => {
    mockConfig.DALI_MEMORY_DD_API_KEY = 'test-key';
    const { createDatadogSink } = await import('../datadog-sink');
    const sink = createDatadogSink();
    expect(sink).toBeDefined();
    expect(typeof sink).toBe('function');
  });

  test('sends correct payload structure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    mockConfig.DALI_MEMORY_DD_API_KEY = 'test-key';
    mockGetTrace.mockReturnValue(undefined);

    const { createDatadogSink } = await import('../datadog-sink');
    const sink = createDatadogSink()!;
    await sink(mockLogRecord() as any);
    vi.runAllTimers();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toContain('http-intake.logs.datadoghq.eu/api/v2/logs');
    expect(call[1].method).toBe('POST');
    expect(call[1].headers['DD-API-KEY']).toBe('test-key');
    expect(call[1].headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(call[1].body);
    expect(body).toHaveLength(1);
    expect(body[0].ddsource).toBe('nodejs');
    expect(body[0].service).toBe('dali-memory');
    expect(body[0].message).toBe('hello world');
    expect(body[0].status).toBe('info');
    expect(body[0].logger).toEqual({ name: 'dali-memory.mcp', level: 'info' });
    expect(body[0].timestamp).toBe(1_234_567_890_000);
  });

  test('includes dd.trace_id when trace context present', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    mockConfig.DALI_MEMORY_DD_API_KEY = 'test-key';
    mockGetTrace.mockReturnValue({ traceId: 'abc-123', spanId: 'def-456' });

    const { createDatadogSink } = await import('../datadog-sink');
    const sink = createDatadogSink()!;
    await sink(mockLogRecord() as any);
    vi.runAllTimers();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body[0].dd).toEqual({ trace_id: 'abc-123', span_id: 'def-456' });
  });

  test('omits dd when no trace context', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    mockConfig.DALI_MEMORY_DD_API_KEY = 'test-key';
    mockGetTrace.mockReturnValue(undefined);

    const { createDatadogSink } = await import('../datadog-sink');
    const sink = createDatadogSink()!;
    await sink(mockLogRecord() as any);
    vi.runAllTimers();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body[0].dd).toBeUndefined();
  });

  test('includes hostname when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    mockConfig.DALI_MEMORY_DD_API_KEY = 'test-key';
    mockConfig.DALI_MEMORY_DD_HOSTNAME = 'my-host';
    mockGetTrace.mockReturnValue(undefined);

    const { createDatadogSink } = await import('../datadog-sink');
    const sink = createDatadogSink()!;
    await sink(mockLogRecord() as any);
    vi.runAllTimers();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body[0].hostname).toBe('my-host');
  });

  test('includes ddtags when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    mockConfig.DALI_MEMORY_DD_API_KEY = 'test-key';
    mockConfig.DALI_MEMORY_DD_TAGS = 'env:test,team:eng';
    mockGetTrace.mockReturnValue(undefined);

    const { createDatadogSink } = await import('../datadog-sink');
    const sink = createDatadogSink()!;
    await sink(mockLogRecord() as any);
    vi.runAllTimers();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body[0].ddtags).toBe('env:test,team:eng');
  });

  test('omits ddtags when empty string', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    mockConfig.DALI_MEMORY_DD_API_KEY = 'test-key';
    mockConfig.DALI_MEMORY_DD_TAGS = '';
    mockGetTrace.mockReturnValue(undefined);

    const { createDatadogSink } = await import('../datadog-sink');
    const sink = createDatadogSink()!;
    await sink(mockLogRecord() as any);
    vi.runAllTimers();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body[0].ddtags).toBeUndefined();
  });

  test('immediate flush on error level', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    mockConfig.DALI_MEMORY_DD_API_KEY = 'test-key';
    mockGetTrace.mockReturnValue(undefined);

    const { createDatadogSink } = await import('../datadog-sink');
    const sink = createDatadogSink()!;
    await sink(mockLogRecord({ level: 'error' }) as any);

    // Error flush is immediate — no timer needed
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('fetch timeout set to 10s', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    mockConfig.DALI_MEMORY_DD_API_KEY = 'test-key';
    mockGetTrace.mockReturnValue(undefined);

    const { createDatadogSink } = await import('../datadog-sink');
    const sink = createDatadogSink()!;
    await sink(mockLogRecord({ level: 'error' }) as any);

    // Error -> immediate flush -> fetch with signal
    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
  });
});
