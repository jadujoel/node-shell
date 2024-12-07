// index.ts

import type Bun from 'bun';
import * as childProcess from "node:child_process";
import type { Writable } from 'node:stream';
import jsonc from "jsonc-parser";

export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;

export interface ShellPromiseState {
	shell?: string;
	cwd?: string;
	env?: Record<string, string>;
	timeout?: number;
	quiet: boolean;
	nothrow: boolean;
	closed: boolean;
	childStdin?: Writable;
	childStdout?: NodeJS.ReadableStream;
}

export class ShellOutput implements Bun.ShellOutput {
	constructor(
		public stdout: Buffer,
		public stderr: Buffer,
		private state: ShellPromiseState,
		public exitCode: number,
		public success: boolean,
		private input?: Writable,
	) {}

	/**
	 * Access the writable stdin stream of the process. If the process has already exited
	 * or did not provide a writable stdin, this will throw an error.
	 *
	 * @throws {Error} If stdin is not available
	 */
	get stdin(): Writable {
		if (!this.input) {
			throw new Error("stdin is not available");
		}
		return this.input;
	}

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
	arrayBuffer(): ArrayBuffer {
		return this.stdout.buffer as ArrayBuffer;
	}

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
	 */
	text(): string {
		return this.stdout.toString();
	}

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
	blob(): Blob {
		return new Blob([this.stdout]);
	}

	/**
	 * Read from stdout as a Uint8Array
	 *
	 * @returns Stdout as a Uint8Array
	 * @example
	 *
	 * ```ts
	 * const output = await $`echo hello`;
	 * console.log(output.bytes()); // Uint8Array { byteLength: 6 }
	 * ```
	 */
	bytes(): Uint8Array {
		return this.stdout as unknown as Uint8Array;
	}

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
	json<T = JSONValue>(): T | undefined {
		try {
			return jsonc.parse(this.stdout.toString(), [], {
				disallowComments: false,
				allowEmptyContent: true,
				allowTrailingComma: true,
			}) as T;
		} catch (e) {
			if (!this.state.quiet) {
				process.stderr.write(String(e));
			}
			return undefined;
		}
	}
}

/// template string function
export function $(strings: TemplateStringsArray, ...keys: string[]) {
	const cmd = strings.reduce((acc, str, i) => {
		return acc + str + (keys[i] ?? "");
	}, "");
	return run(cmd);
}

export function run(command: string): ShellPromise {
	return ShellPromise.FromCommand(command);
}

export class ShellPromise {
	#promise: Promise<ShellOutput> | undefined;

	constructor(
		private command: string,
		private state: ShellPromiseState,
	) {}

	static FromCommand(command: string) {
		return new ShellPromise(command, {
			quiet: false,
			nothrow: false,
			closed: false,
		});
	}

	get promise(): Promise<ShellOutput> {
		if (!this.#promise) {
			this.#promise = createPromise(this.state, this.command);
		}
		return this.#promise;
	}

	/**
	 * Access the writable stdin stream of the running process.
	 * If the process hasn't started yet, accessing this will start it.
	 * If the process has already finished, this may not be available.
	 *
	 * @throws {Error} If stdin is not available yet or the process already closed
	 */
	get stdin(): Writable {
		// Ensure the promise (and thus the child process) is started:
		if (!this.#promise) {
			void this.promise; // triggers createPromise
		}

		if (!this.state.childStdin) {
			throw new Error("stdin is not available yet or process already closed");
		}
		return this.state.childStdin;
	}

	// biome-ignore lint/suspicious/noThenProperty: <explanation>
	then(
		onfulfilled: (value: ShellOutput) => ShellOutput | PromiseLike<ShellOutput>,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		onrejected?: (reason: any) => any,
	): Promise<ShellOutput> {
		return this.promise.then(onfulfilled, onrejected);
	}

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	catch(onrejected: (reason: any) => any): Promise<ShellOutput> {
		return this.promise.catch(onrejected);
	}

	finally(onfinally: () => void): Promise<ShellOutput> {
		return this.promise.finally(onfinally);
	}

	/**
	 * Change the current working directory of the shell.
	 * @param newCwd - The new working directory
	 */
	cwd(cwd: string): this {
		this.state.cwd = cwd;
		return this;
	}

	/**
	 * Set a timeout for the command execution.
	 * @param timeout - The timeout in milliseconds
	 */
	timeout(timeout: number): this {
		this.state.timeout = timeout;
		return this;
	}

	/**
	 * Disable printing of stdout and stderr to the terminal.
	 */
	quiet(): this {
		this.state.quiet = true;
		return this;
	}

	/**
	 * Configure the shell to not throw an exception on non-zero exit codes.
	 * By default, the shell will throw.
	 */
	nothrow(): this {
		this.state.nothrow = true;
		return this;
	}

	/**
	 * Configure whether or not the shell should throw an exception on non-zero exit codes.
	 *
	 * By default, this is configured to `true`.
	 */
	throws(shouldThrow: boolean): this {
		this.state.nothrow = !shouldThrow;
		return this;
	}

	/**
	 * Set environment variables for the shell.
	 * @param newEnv - The new environment variables
	 *
	 * @example
	 * ```ts
	 * await $`echo $FOO`.env({ ...process.env, FOO: "LOL!" })
	 * expect(stdout.toString()).toBe("LOL!");
	 * ```
	 */
	env(env: Record<string, string>) {
		this.state.env = env;
		return this;
	}

	/**
	 * Set the shell to use.
	 * @param shell - The shell to use, e.g. '/bin/bash'
	 */
	shell(shell: string): this {
		this.state.shell = shell;
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
	 */
	async text(): Promise<string> {
		this.quiet();
		return this.promise.then((p) => p.stdout.toString());
	}

	/**
	 * Read from stdout as a string, line by line
	 *
	 * Automatically calls {@link quiet} to disable echoing to stdout.
	 * This yields lines as they arrive from the process, without waiting for it to finish.
	 */
	lines(): AsyncIterable<string> {
		this.quiet();
		// Ensure the process is started
		if (!this.#promise) {
			void this.promise;
		}

		const stream = this.state.childStdout;
		if (!stream) {
			// If no stdout is available yet, throw an error
			throw new Error("stdout is not available");
		}

		const lineGenerator = async function* (inputStream: NodeJS.ReadableStream) {
			let buffer = '';
			for await (const chunk of inputStream) {
				buffer += chunk.toString();
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? ""; // last element might be incomplete line
				for (const line of lines) {
					yield line;
				}
			}
			if (buffer.length > 0) {
				yield buffer;
			}
		};

		return lineGenerator(stream);
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
	async json<T = JSONValue>(): Promise<T | undefined> {
		this.quiet();
		return this.promise.then((p) => p.json());
	}

	async toString(): Promise<string> {
		this.quiet();
		return this.promise.then((p) => p.text());
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
	async arrayBuffer(): Promise<ArrayBuffer> {
		this.quiet();
		return this.promise.then((p) => p.arrayBuffer());
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
	async blob(): Promise<Blob> {
		this.quiet();
		return this.promise.then((p) => p.blob());
	}
}

export function createPromise(state: ShellPromiseState, command: string) {
	return new Promise<ShellOutput>((resolve, reject) => {
		const stdout: Uint8Array[] = [];
		const stderr: Uint8Array[] = [];

		const env = {
			...process.env,
			...state.env,
		};

		const child = childProcess.spawn(command, {
			cwd: state.cwd,
			env,
			shell: state.shell ?? true,
			timeout: state.timeout,
			stdio: ["pipe", "pipe", "pipe"],
		});

		// Store child's stdin and stdout so we can provide them via ShellPromise and ShellOutput
		state.childStdin = child.stdin;
		state.childStdout = child.stdout;

		const onError = (err: string | Error) => {
			if (state.closed) return;
			state.closed = true;
			const final = new ShellOutput(
				Buffer.concat(stdout),
				Buffer.concat(stderr),
				state,
				1,
				false,
				child.stdin,
			);
			if (!state.quiet) {
				console.error(err);
			}
			if (state.nothrow) {
				resolve(final);
			} else {
				reject(typeof err === "string" ? new Error(err) : err);
			}
		};

		child.stdout?.on("data", (data: Uint8Array) => {
			stdout.push(data);
			if (!state.quiet) {
				process.stdout.write(data);
			}
		});

		child.stderr?.on("data", (data: Uint8Array) => {
			stderr.push(data);
			if (!state.quiet) {
				process.stderr.write(data);
			}
		});

		child.on("close", (code) => {
			if (state.closed) return;
			state.closed = true;
			const exitCode = code ?? 1;
			const final = new ShellOutput(
				Buffer.concat(stdout),
				Buffer.concat(stderr),
				state,
				exitCode,
				exitCode === 0,
				child.stdin,
			);
			if (exitCode === 0) {
				resolve(final);
			} else {
				if (state.nothrow) {
					resolve(final);
				} else {
					const err = new Error(
						final.stderr.toString() || `Command failed with code ${exitCode}`,
					);
					reject(err);
				}
			}
		});

		child.on('disconnect', () => onError("Disconnected"));
		child.on("error", (err) => onError(err));
	});
}

export default $
