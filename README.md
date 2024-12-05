# Node Shell

A lightweight and flexible shell execution library for Node.js that enables running shell commands with a clean and extensible API. This library supports piping output, handling errors, setting environment variables, and working with multiple data formats.

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

Here are some common examples of how to use `@jadujoel/node-shell`.

### Importing the Library

```typescript
import { $ } from '@jadujoel/node-shell';
```

### Running a Command

Run a simple shell command and capture its output:

```typescript
const result = await $`echo Hello, World!`.text();
console.log(result); // Output: Hello, World!
```

### Using Environment Variables

Set custom environment variables for the command:

```typescript
const env = { GREETING: "Hello" };
const result = await $`echo $GREETING, World!`.env(env).text();
console.log(result); // Output: Hello, World!
```

### Handling Errors

#### Fail Quietly

Use `.nothrow()` to prevent errors from being thrown, and instead handle them in the result:

```typescript
const result = await $`nonexistent-command`.nothrow().quiet().text();
console.log(result); // Output: ""
```

#### Fail Loudly

By default, errors are thrown when a command fails:

```typescript
try {
  await $`nonexistent-command`.text();
} catch (error) {
  console.error(error.message); // Output: /bin/sh: nonexistent-command: command not found
}
```

### Working with JSON

Parse the output of a shell command as JSON:

```typescript
const json = await $`echo '{"key":"value"}'`.json();
console.log(json); // Output: { key: 'value' }
```

### Working with Binary Data

#### ArrayBuffer

Capture the output of a command as an `ArrayBuffer`:

```typescript
const buffer = await $`echo Hello`.quiet().arrayBuffer();
console.log(buffer.constructor.name); // Output: ArrayBuffer
```

#### Blob

Capture the output of a command as a `Blob` (useful in browser-like environments):

```typescript
const blob = await $`echo Hello`.quiet().blob();
console.log(blob.constructor.name); // Output: Blob
```

### Piping Output

Suppress stdout and stderr by using `.quiet()`:

```typescript
await $`echo Hello`.quiet();
```

## API

### Template Tag: $

A tagged template function to execute shell commands.

#### Example:

```typescript
const result = await $`ls -l`.text();
```

### Methods

- **`text()`**: Resolves with the command's stdout as a string.
- **`json()`**: Resolves with the command's stdout parsed as JSON.
- **`arrayBuffer()`**: Resolves with the command's stdout as an `ArrayBuffer`.
- **`blob()`**: Resolves with the command's stdout as a `Blob`.
- **`env(env: Record<string, string>)`**: Sets environment variables for the command.
- **`quiet()`**: Suppresses stdout and stderr output.
- **`nothrow()`**: Prevents errors from being thrown when the command fails.

