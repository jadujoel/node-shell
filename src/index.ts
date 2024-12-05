import * as childProcess from "node:child_process";
interface ShellOutput {
	stdout: string;
	stderr: string;
	success: boolean;
}

/// template string function
export function $(strings: TemplateStringsArray, ...keys: string[]) {
	return run(
		strings.reduce((acc, str, i) => {
			return acc + str + (keys[i] ?? "");
		}, ""),
	);
}

export function run(command: string): ShellPromise {
	return ShellPromise.FromCommand(command);
}

interface ShellPromiseState {
	quiet: boolean;
	nothrow: boolean;
	closed: boolean;
}

class ShellPromise {
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
		return this.#promise ?? createPromise(this.state, this.command);
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

	quiet(): this {
		this.state.quiet = true;
		return this;
	}
	nothrow(): this {
		this.state.nothrow = true;
		return this;
	}
	env(env: Record<string, string>) {
		Object.assign(process.env, env);
		return this;
	}
	async text(): Promise<string> {
		return this.promise.then((p) => p.stdout);
	}
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	async json<T = any>(): Promise<T> {
		return this.promise.then((p) => JSON.parse(p.stdout));
	}
	async toString(): Promise<string> {
		return this.promise.then((p) => p.stdout);
	}
	async arrayBuffer(): Promise<ArrayBuffer> {
		return this.promise.then(
			(p) => Buffer.from(p.stdout).buffer as ArrayBuffer,
		);
	}
}

const createPromise = (state: ShellPromiseState, command: string) =>
	new Promise<ShellOutput>((resolve, reject) => {
		const result: ShellOutput = {
			stdout: "",
			stderr: "",
			success: true,
		};
		const child = childProcess.exec(command);
		child.stdout?.on("data", (data) => {
			const str = data.toString();
			result.stdout += str;
			if (!state.quiet) {
				process.stdout.write(str);
			}
		});
		child.stderr?.on("data", (data) => {
			const str = data.toString();
			result.stderr += str;
			if (!state.quiet) {
				process.stderr.write(str);
			}
		});
		child.on("error", (err) => {
			console.log("Error", err);
			if (state.closed) {
				return;
			}
			state.closed = true;
			result.success = false;
			if (!state.quiet) {
				console.error(err);
			}
			if (state.nothrow) {
				resolve(result);
			} else {
				reject(err);
			}
		});
		child.stdout?.on("close", () => {
			if (state.closed) {
				return;
			}
			state.closed = true;
			if (child.exitCode === 0) {
				resolve(result);
			} else {
				result.success = false;
				if (state.nothrow) {
					resolve(result);
				} else {
					reject(new Error(result.stderr));
				}
			}
		});
		child.stderr?.on("close", () => {
			if (state.closed) {
				return;
			}
			state.closed = true;
			if (child.exitCode === 0 || result.stderr === "") {
				resolve(result);
			} else {
				result.success = false;
				if (state.nothrow) {
					resolve(result);
				} else {
					reject(new Error(result.stderr));
				}
			}
		});
	});
