import { fromAsyncSink, type AsyncSink, type LogRecord, type Sink } from '@logtape/logtape';
import { getConfig } from './config';
import { getTrace } from './trace-context';

const LEVEL_MAP: Record<string, string> = {
  trace: 'trace',
  debug: 'debug',
  info: 'info',
  warning: 'warn',
  error: 'error',
  fatal: 'fatal',
};

export function formatMessage(message: readonly unknown[]): string {
  return message
    .map((v) => {
      if (v == null) return 'null';
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    })
    .join(' ');
}

/**
 * Create a Datadog log sink.
 *
 * Reads `DALI_MEMORY_DD_API_KEY` from config. Returns `null` when the key is
 * absent — the sink is disabled and no logs are sent to Datadog.
 *
 * Logs are batched and flushed every 5 seconds, when the batch reaches 100
 * entries, or immediately on `error` / `fatal` level records.
 *
 * Trace context (traceId / spanId) from the current request scope is
 * attached to each log entry under the `dd` field for trace correlation.
 */
export function createDatadogSink(): Sink | null {
  const {
    DALI_MEMORY_DD_API_KEY: apiKey,
    DALI_MEMORY_DD_SITE: site,
    DALI_MEMORY_DD_SERVICE: service,
    DALI_MEMORY_DD_HOSTNAME: hostname,
    DALI_MEMORY_DD_TAGS: tags,
    DALI_MEMORY_DD_SOURCE: source,
  } = getConfig();

  if (!apiKey) return null;
  const key: string = apiKey;

  const endpoint = `https://http-intake.logs.${site}/api/v2/logs`;

  let batch: Array<Record<string, unknown>> = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let flushing = false;

  function scheduleFlush(): void {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush().catch(() => {});
    }, 5000);
  }

  async function flush(): Promise<void> {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (batch.length === 0) return;
    if (flushing) return;
    flushing = true;
    const entries = batch.splice(0);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': key,
        },
        body: JSON.stringify(entries),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        console.error(`[datadog-sink] Failed to send logs: ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.error('[datadog-sink] Failed to send logs:', err);
    } finally {
      flushing = false;
      if (batch.length > 0) {
        scheduleFlush();
      }
    }
  }

  const asyncSink: AsyncSink = async (record: LogRecord): Promise<void> => {
    const trace = getTrace();

    const entry: Record<string, unknown> = {
      ddsource: source,
      service,
      message: formatMessage(record.message),
      status: LEVEL_MAP[record.level] ?? record.level,
      timestamp: record.timestamp,
      logger: {
        name: record.category.join('.'),
        level: record.level,
      },
    };

    if (hostname) entry.hostname = hostname;
    if (tags) entry.ddtags = tags;
    if (trace) {
      entry.dd = {
        trace_id: trace.traceId,
        ...(trace.spanId ? { span_id: trace.spanId } : {}),
      };
    }
    if (Object.keys(record.properties).length > 0) {
      entry.properties = { ...record.properties };
    }

    batch.push(entry);

    if (batch.length >= 100 || record.level === 'error' || record.level === 'fatal') {
      await flush();
    } else {
      scheduleFlush();
    }
  };

  return fromAsyncSink(asyncSink);
}
