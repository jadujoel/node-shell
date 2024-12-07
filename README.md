```markdown
# Node Shell

A lightweight and flexible shell execution library for Node.js that enables running shell commands with a clean and extensible API. This library provides a powerful `$` template function for executing commands, as well as methods to control command execution, parse output in various formats, handle errors gracefully, and even stream input and output.

## Features

- **Simple command execution** using a tagged template function.
- **Streaming stdout** line-by-line as the command runs, without waiting for completion.
- **Access to stdin** for sending data to running processes.
- **Flexible error handling** (fail loudly by default, or opt into non-throwing mode).
- **Quiet mode** to suppress output from being printed to the terminal.
- **Easy environment variable injection**.
- **Parsing output as text, JSON, ArrayBuffer, or Blob**.
- **Timeout support** to terminate long-running commands.

## Installation

Install the package using npm:

```bash
npm install @jadujoel/node-shell
```

Or using Yarn:

```bash
yarn add @jadujoel/node-shell
```

## Usage

### Importing the Library

```typescript
import { $ } from '@jadujoel/node-shell';
```

### Running a Command

Run a simple shell command and capture its output:

```typescript
const result = await $`echo Hello, World!`.text();
console.log(result); // Output: "Hello, World!\n"
```

### Using Environment Variables

Set custom environment variables for the command:

```typescript
const env = { GREETING: "Hello" };
const result = await $`echo $GREETING, World!`.env(env).text();
console.log(result); // Output: "Hello, World!\n"
```

### Handling Errors

#### Fail Quietly

Use `.nothrow()` to prevent errors from being thrown, and instead handle them in the result:

```typescript
const result = await $`nonexistent-command`.nothrow().quiet().text();
console.log(result); // Output: "" (empty string, command failed but no error thrown)
```

#### Fail Loudly

By default, errors are thrown when a command fails:

```typescript
try {
  await $`nonexistent-command`.text();
} catch (error) {
  console.error(error.message);
  // Possible output: "/bin/sh: nonexistent-command: command not found"
}
```

### Working with JSON

Parse the output of a shell command as JSON:

```typescript
const json = await $`echo '{"key":"value"}'`.quiet().json();
console.log(json); // Output: { key: 'value' }
```

### Working with Binary Data

#### ArrayBuffer

Capture the output of a command as an `ArrayBuffer`:

```typescript
const buffer = await $`echo Hello`.quiet().arrayBuffer();
console.log(buffer.constructor.name); // Output: "ArrayBuffer"
```

#### Blob

Similarly, capture output as a Blob:

```typescript
const blob = await $`echo Hello`.quiet().blob();
console.log(blob.size); // Output: 6
```

### Accessing Stdin

You can write to the `stdin` of a running command:

```typescript
const proc = $`cat`.quiet().nothrow();
proc.stdin.write("Hello from stdin!\n");
proc.stdin.end();

const result = await proc;
console.log(result.text()); // Output: "Hello from stdin!\n"
```

### Printing Each Line as it is Received

The `.lines()` method returns an async iterable that yields lines as they are emitted by the command's `stdout`. This allows you to process output in real-time, rather than waiting for the command to finish.

```typescript
const start = Date.now();
{
  const shell = $`echo "Hello, World!" && sleep 1 && echo "Goodbye, World!" && sleep 1`;

  let i = 0;
  for await (const line of shell.lines()) {
    const timeTaken = Date.now() - start;
    console.log(`Line ${i++}: ${line} [${timeTaken}ms]`);
  }

  console.log(`Total time taken: ${Date.now() - start}ms`);
}
// This will print the first line after ~0ms, then the second line after ~1000ms.
```

### Controlling Execution

- **`quiet()`**: Suppress stdout and stderr from being printed to your terminal.
- **`nothrow()`**: Do not throw an error on non-zero exit codes; instead, return the result.
- **`throws(true/false)`**: Control whether non-zero exit codes result in an error being thrown.
- **`env()`**: Set environment variables for the command.
- **`cwd()`**: Set a custom working directory.
- **`timeout()`**: Set a timeout after which the command will be killed if not completed.

### Direct Awaiting

You can `await` the shell command directly, which resolves to a `ShellOutput` object:

```typescript
const output = await $`echo hello`.quiet();
console.log(output.stdout.toString()); // "hello\n"
```

## API

### Template Tag: $

A tagged template function to execute shell commands.

**Example:**

```typescript
const result = await $`ls -l`.text();
console.log(result);
```

### Methods

- **`text()`**: Resolves with the command's stdout as a string.
- **`json()`**: Resolves with the command's stdout as a parsed JSON object.
- **`arrayBuffer()`**: Resolves with stdout as an `ArrayBuffer`.
- **`blob()`**: Resolves with stdout as a `Blob`.
- **`lines()`**: Returns an async iterable that yields each line of stdout as it arrives.
- **`env(env: Record<string, string>)`**: Sets environment variables for the command.
- **`quiet()`**: Suppresses stdout and stderr output.
- **`nothrow()`**: Prevents errors from being thrown on non-zero exit codes.
- **`throws(boolean)`**: Control error throwing behavior based on exit codes.
- **`cwd(path: string)`**: Change the command's working directory.
- **`timeout(ms: number)`**: Set a timeout for the command execution.

## Contributing

Contributions are welcome! Feel free to open issues or pull requests if you have improvements or find bugs.

