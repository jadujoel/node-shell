import * as childProcess from "child_process";

export function $(command: string): ShellPromise {
  return new ShellPromise((resolve) => {
    await resolve

  });
}

/**
	 * A process created by {@link Bun.spawn}.
	 *
	 * This type accepts 3 optional type parameters which correspond to the `stdio` array from the options object. Instead of specifying these, you should use one of the following utility types instead:
	 * - {@link ReadableSubprocess} (any, pipe, pipe)
	 * - {@link WritableSubprocess} (pipe, any, any)
	 * - {@link PipedSubprocess} (pipe, pipe, pipe)
	 * - {@link NullSubprocess} (ignore, ignore, ignore)
	 */
interface Subprocess<
  In extends SpawnOptions.Writable = SpawnOptions.Writable,
  Out extends SpawnOptions.Readable = SpawnOptions.Readable,
  Err extends SpawnOptions.Readable = SpawnOptions.Readable,
  > extends AsyncDisposable {
  readonly stdin: SpawnOptions.WritableToIO<In>;
  readonly stdout: SpawnOptions.ReadableToIO<Out>;
  readonly stderr: SpawnOptions.ReadableToIO<Err>;

  /**
   * This returns the same value as {@link Subprocess.stdout}
   *
   * It exists for compatibility with {@link ReadableStream.pipeThrough}
   */
  readonly readable: SpawnOptions.ReadableToIO<Out>;

  /**
   * The process ID of the child process
   * @example
   * ```ts
   * const { pid } = Bun.spawn({ cmd: ["echo", "hello"] });
   * console.log(pid); // 1234
   * ```
   */
  readonly pid: number;
  /**
   * The exit code of the process
   *
   * The promise will resolve when the process exits
   */
  readonly exited: Promise<number>;

  /**
   * Synchronously get the exit code of the process
   *
   * If the process hasn't exited yet, this will return `null`
   */
  readonly exitCode: number | null;

  /**
   * Synchronously get the signal code of the process
   *
   * If the process never sent a signal code, this will return `null`
   *
   * To receive signal code changes, use the `onExit` callback.
   *
   * If the signal code is unknown, it will return the original signal code
   * number, but that case should essentially never happen.
   */
  readonly signalCode: NodeJS.Signals | null;

  /**
   * Has the process exited?
   */
  readonly killed: boolean;

  /**
   * Kill the process
   * @param exitCode The exitCode to send to the process
   */
  kill(exitCode?: number | NodeJS.Signals): void;
}



export type ShellFunction = (input: Uint8Array) => Uint8Array;

export type ShellExpression =
  | { toString(): string }
  | Array<ShellExpression>
  | string
  | { raw: string }
  | Subprocess
  | ReadableStream;

class ShellPromise extends Promise<ShellOutput> {
  stdout: Buffer = Buffer.from("");
  stderr: Buffer = Buffer.from("");
  isQuiet: boolean = false;
  isNothrow: boolean = false;

  /**
   * By default, the shell will write to the current process's stdout and stderr, as well as buffering that output.
   *
   * This configures the shell to only buffer the output.
   */
  quiet(): this {
    this.isQuiet = true;
    return this;
  }

  /**
   * Read from stdout as a string
   *
   * Automatically calls {@link quiet} to disable echoing to stdout.
   * @param encoding - The encoding to use when decoding the output
   * @returns A promise that resolves with stdout as a string
   * @example
   *
   * ## Read as UTF-8 string
   *
   * ```ts
   * const output = await $`echo hello`.text();
   * console.log(output); // "hello\n"
   * ```
   *
   * ## Read as base64 string
   *
   * ```ts
   * const output = await $`echo ${atob("hello")}`.text("base64");
   * console.log(output); // "hello\n"
   * ```
   *
   */
  text(encoding?: BufferEncoding): Promise<string> {
    return Promise.resolve(this.stdout.toString(encoding));
  }

  /**
   * Read from stdout as a JSON object
   *
   * Automatically calls {@link quiet}
   *
   * @returns A promise that resolves with stdout as a JSON object
   * @example
   *
   * ```ts
   * const output = await $`echo '{"hello": 123}'`.json();
   * console.log(output); // { hello: 123 }
   * ```
   *
   */
  json(): Promise<any> {
    return Promise.resolve(JSON.parse(this.stdout.toString()));
  }

  /**
   * Read from stdout as an ArrayBuffer
   *
   * Automatically calls {@link quiet}
   * @returns A promise that resolves with stdout as an ArrayBuffer
   * @example
   *
   * ```ts
   * const output = await $`echo hello`.arrayBuffer();
   * console.log(output); // ArrayBuffer { byteLength: 6 }
   * ```
   */
  arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(this.stdout.buffer as ArrayBuffer);
  }

  /**
   * Read from stdout as a Blob
   *
   * Automatically calls {@link quiet}
   * @returns A promise that resolves with stdout as a Blob
   * @example
   * ```ts
   * const output = await $`echo hello`.blob();
   * console.log(output); // Blob { size: 6, type: "" }
   * ```
   */
  blob(): Promise<Blob> {
    return Promise.resolve(new Blob([this.stdout]));
  }

  /**
   * Configure the shell to not throw an exception on non-zero exit codes. Throwing can be re-enabled with `.throws(true)`.
   *
   * By default, the shell with throw an exception on commands which return non-zero exit codes.
   */
  nothrow(): this {
    this.isNothrow = true;
    return this;
  }
}

interface ShellConstructor {
  new (): Shell;
}

export interface Shell {
  (
    strings: TemplateStringsArray,
    ...expressions: ShellExpression[]
  ): ShellPromise;

  /**
   * Perform bash-like brace expansion on the given pattern.
   * @param pattern - Brace pattern to expand
   *
   * @example
   * ```js
   * const result = braces('index.{js,jsx,ts,tsx}');
   * console.log(result) // ['index.js', 'index.jsx', 'index.ts', 'index.tsx']
   * ```
   */
  braces(pattern: string): string[];

  /**
   * Escape strings for input into shell commands.
   * @param input
   */
  escape(input: string): string;

  /**
   *
   * Change the default environment variables for shells created by this instance.
   *
   * @param newEnv Default environment variables to use for shells created by this instance.
   * @default process.env
   *
   * ## Example
   *
   * ```js
   * import {$} from 'bun';
   * $.env({ BUN: "bun" });
   * await $`echo $BUN`;
   * // "bun"
   * ```
   */
  env(newEnv?: Record<string, string | undefined>): this;

  /**
   *
   * @param newCwd Default working directory to use for shells created by this instance.
   */
  cwd(newCwd?: string): this;

  /**
   * Configure the shell to not throw an exception on non-zero exit codes.
   */
  nothrow(): this;

  /**
   * Configure whether or not the shell should throw an exception on non-zero exit codes.
   */
  throws(shouldThrow: boolean): this;

  readonly ShellPromise: typeof ShellPromise;
  readonly Shell: ShellConstructor;
}

export interface ShellOutput {
  readonly stdout: Buffer;
  readonly stderr: Buffer;
  readonly exitCode: number;

  /**
   * Read from stdout as a string
   *
   * @param encoding - The encoding to use when decoding the output
   * @returns Stdout as a string with the given encoding
   * @example
   *
   * ## Read as UTF-8 string
   *
   * ```ts
   * const output = await $`echo hello`;
   * console.log(output.text()); // "hello\n"
   * ```
   *
   * ## Read as base64 string
   *
   * ```ts
   * const output = await $`echo ${atob("hello")}`;
   * console.log(output.text("base64")); // "hello\n"
   * ```
   *
   */
  text(encoding?: BufferEncoding): string;

  /**
   * Read from stdout as a JSON object
   *
   * @returns Stdout as a JSON object
   * @example
   *
   * ```ts
   * const output = await $`echo '{"hello": 123}'`;
   * console.log(output.json()); // { hello: 123 }
   * ```
   *
   */
  json(): any;

  /**
   * Read from stdout as an ArrayBuffer
   *
   * @returns Stdout as an ArrayBuffer
   * @example
   *
   * ```ts
   * const output = await $`echo hello`;
   * console.log(output.arrayBuffer()); // ArrayBuffer { byteLength: 6 }
   * ```
   */
  arrayBuffer(): ArrayBuffer;

  /**
   * Read from stdout as an Uint8Array
   *
   * @returns Stdout as an Uint8Array
   * @example
   *
   * ```ts
   * const output = await $`echo hello`;
   * console.log(output.bytes()); // Uint8Array { byteLength: 6 }
   * ```
   */
  bytes(): Uint8Array;

  /**
   * Read from stdout as a Blob
   *
   * @returns Stdout as a blob
   * @example
   * ```ts
   * const output = await $`echo hello`;
   * console.log(output.blob()); // Blob { size: 6, type: "" }
   * ```
   */
  blob(): Blob;
}
