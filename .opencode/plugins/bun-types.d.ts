// Minimal Bun type declarations for OpenCode plugins
// These plugins run in the OpenCode/Bun environment
declare namespace Bun {
  function file(path: string | URL): BunFile;
  function spawn(command: string[], options?: SpawnOptions): SpawnProcess;
  function which(command: string): string | null;
  function write(path: string | URL, data: string | ArrayBufferView): Promise<number>;
  function read(path: string | URL): Promise<string>;

  interface BunFile {
    text(): Promise<string>;
    json<T = unknown>(): Promise<T>;
    exists(): Promise<boolean>;
    size: number;
    type: string;
  }

  interface SpawnOptions {
    cwd?: string;
    stdout?: 'pipe' | 'inherit' | 'ignore' | number;
    stderr?: 'pipe' | 'inherit' | 'ignore' | number;
    stdin?: 'pipe' | 'inherit' | 'ignore' | number;
    env?: Record<string, string>;
    onExit?: (
      proc: SpawnProcess,
      exitCode: number | null,
      signalCode: string | null,
      error?: Error,
    ) => void;
  }

  interface SpawnProcess {
    pid: number;
    stdout: ReadableStream;
    stderr: ReadableStream;
    exited: Promise<number>;
    kill(code?: number): void;
  }
}

// Timer type used in with-timeout.ts
type Timer = ReturnType<typeof setTimeout>;
