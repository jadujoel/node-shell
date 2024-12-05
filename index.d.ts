interface ShellOutput {
    stdout: string;
    stderr: string;
    success: boolean;
}
export declare function $(strings: TemplateStringsArray, ...keys: string[]): {
    "__#1@#promise": Promise<ShellOutput> | undefined;
    readonly promise: Promise<unknown>;
    quiet(): /*elided*/ any;
    nothrow(): /*elided*/ any;
    env(env: Record<string, string>): /*elided*/ any;
    text(): Promise<string>;
    json(): Promise<any>;
    toString(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
    blob(): Promise<Blob>;
};
/**
 * @param {string} command
 * @returns {Promise<>}
 */
export declare function run(command: string): {
    "__#1@#promise": Promise<ShellOutput> | undefined;
    readonly promise: Promise<unknown>;
    quiet(): /*elided*/ any;
    nothrow(): /*elided*/ any;
    env(env: Record<string, string>): /*elided*/ any;
    text(): Promise<string>;
    json(): Promise<any>;
    toString(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
    blob(): Promise<Blob>;
};
export {};
