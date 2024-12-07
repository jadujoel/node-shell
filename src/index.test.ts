// index.test.ts

import * as test from 'node:test';
import * as assert from 'node:assert';
import { $ } from './index.js';

test.it('should echo hello world', async () => {
  const env = { hello: "world" };
  const result = $`echo $hello`;
  const text = await result.env(env).quiet().text();
  assert.equal(text, 'world\n');
});

test.it('should fail quietly', async () => {
  const result = await $`fail`.nothrow().quiet().text();
  assert.equal(result, '');
});

test.it('should fail loudly', async () => {
  let result: string | undefined = undefined;
  try {
    result = await $`fail`.quiet().text();
    assert.fail('THIS LINE SHOULD NOT BE REACHED');
  } catch (e) {
    const expected1 = '/bin/sh: fail: command not found\n';
    const expected2 = '/bin/sh: 1: fail: not found\n';
    const msg = (e as Error).message;
    assert.ok(
      msg === expected1 || msg === expected2,
      `Expected one of ${JSON.stringify([expected1, expected2])}, got ${msg}`
    );
    assert.equal(result, undefined);
  }
});

test.it('should return json', async () => {
  const json = await $`echo '{"hello":"world"}'`.quiet().json();
  assert.deepEqual(json, { hello: 'world' });
});

test.it('should return array buffer', async () => {
  const buffer = await $`echo hello`.quiet().arrayBuffer();
  assert.equal(buffer.constructor.name, 'ArrayBuffer');
});

test.it('should be possible to await directly', async () => {
  const output = await $`echo hello`.quiet();
  // Ensure stdout is a buffer, so convert it to string
  assert.equal(output.stdout.toString(), 'hello\n');
});

test.it('should test shell output properties', async () => {
  const shell = await $`cat package.json`.quiet();
  assert.equal(shell.success, true, "success");
  assert.equal(shell.exitCode, 0, "exitCode");
  assert.equal(shell.text().includes("devDependencies"), true, "text");
  assert.equal(shell.arrayBuffer() instanceof ArrayBuffer, true, "arrayBuffer");
  assert.equal(shell.blob() instanceof Blob, true, "blob");
  assert.equal(shell.bytes() instanceof Uint8Array, true, "bytes");
  assert.notEqual(shell.json().devDependencies, undefined, "json");
});

test.it('cwd check', async () => {
  assert.equal(await $`cat index.ts`.quiet().nothrow().text(), "");
  assert.notEqual(await $`cat index.ts`.cwd("src").quiet().text(), "");
});

test.it('should timeout', async () => {
  let result: string | undefined = undefined;
  try {
    result = await $`sleep 0.1`.timeout(1).quiet().text();
    assert.fail('DID NOT TIMEOUT');
  } catch (e) {
    assert.equal((e as Error).message, 'Command failed with code 1');
    assert.equal(result, undefined);
  }
})

test.it('should not timeout', async () => {
  const result = await $`sleep 0.1`.timeout(200).quiet().text();
  assert.equal(typeof result, "string");
})

test.it('should return toString', async () => {
  const output = await $`echo hello`.quiet().toString();
  assert.equal(output, 'hello\n');
});

test.it('should use a custom shell', async () => {
  // Assuming /bin/bash exists on your system, `$0` should report "bash" or "-bash".
  const output = await $`echo $0`.shell('/bin/bash').quiet().text();
  assert.ok(output.includes('bash'), `Expected bash in output, got ${output}`);
});

test.it('should handle spawn error event', async () => {
  // Force an error by using a non-existent shell. This should trigger the "error" event.
  let result: string | undefined;
  try {
    result = await $`echo hello`.shell('/nonexistent-shell-1234').quiet().text();
    assert.fail('Should have triggered an error event and thrown');
  } catch (e) {
    const msg = (e as Error).message;
    // On most systems, using a non-existent shell will cause a spawn ENOENT error.
    assert.ok(
      msg.includes('ENOENT') || msg.includes('not found'),
      `Expected an ENOENT or not found error, got: ${msg}`
    );
    assert.equal(result, undefined);
  }
});

test.it('should trigger catch branch on failure', async () => {
  let caughtError: Error | undefined;
  await $`fail`
    .quiet()
    .then(() => {
      assert.fail('Promise should not have been fulfilled');
    })
    .catch((err) => {
      caughtError = err;
      assert.ok(err instanceof Error, 'Expected an instance of Error');
    });

  assert.ok(caughtError, 'Expected an error to be caught');
});

test.it('should trigger finally branch on success', async () => {
  let finallyCalled = false;
  await $`echo success`
    .quiet()
    .finally(() => {
      finallyCalled = true;
    });
  assert.equal(finallyCalled, true, 'Expected finally to be called on success');
});

test.it('should trigger finally branch on failure', async () => {
  let finallyCalled = false;
  try {
    await $`fail`
      .quiet()
      .finally(() => {
        finallyCalled = true;
      });
    assert.fail('This should have thrown an error before reaching here');
  } catch (err) {
    assert.ok(err instanceof Error, 'Expected an error');
  }
  assert.equal(finallyCalled, true, 'Expected finally to be called even on failure');
});

test.it('should handle error with quiet and nothrow in onError', async () => {
  // Command fails, but we set quiet and nothrow
  const output = await $`fail`.quiet().nothrow();
  assert.equal(output.success, false, 'Should not succeed');
  assert.notEqual(output.exitCode, 0, 'Exit code should be 127');
  // If quiet is set, no error output should have been printed to console
  // If nothrow is set, it should return result instead of throwing
});

test.it('should cover onStdoutData without quiet', async () => {
  // Run a command that prints to stdout without quiet()
  const output = await $`echo stdout_test`;
  assert.equal(output.text(), 'stdout_test\n');
  // This triggers the !state.quiet branch in stdout data handling
});

test.it('should cover onStderrData without quiet', async () => {
  // Run a command that prints to stderr (like a failing command) without quiet()
  let caughtError: Error | undefined;
  try {
    await $`fail`; // This should print to stderr and fail
  } catch (err) {
    caughtError = err as Error;
  }
  assert.ok(caughtError, 'Expected an error');
  // This triggers the !state.quiet branch in stderr data handling
});

test.it('should cover ShellPromise.catch directly', async () => {
  let caughtError: Error | undefined;

  // Trigger an error and use .catch() directly on the returned shell promise
  await $`fail`.quiet().catch((err) => {
    caughtError = err;
  });

  assert.ok(caughtError instanceof Error, 'Expected an error to be caught directly in .catch()');
});

test.it('should cover ShellPromise.finally directly on success', async () => {
  let finallyCalled = false;
  await $`echo success`.quiet().finally(() => {
    finallyCalled = true;
  });

  assert.equal(finallyCalled, true, 'Expected .finally() to be called on success');
});

test.it('should cover ShellPromise.finally directly on failure', async () => {
  let finallyCalled = false;
  let errorCaught = false;

  await $`fail`.quiet()
    .catch((err) => {
      errorCaught = true;
      return err; // still returns a promise
    })
    .finally(() => {
      finallyCalled = true;
    });

  assert.equal(errorCaught, true, 'Expected error to be caught');
  assert.equal(finallyCalled, true, 'Expected .finally() to be called even on failure');
});

test.it('should trigger console.error and resolve(final) in onError', async () => {
  // This command should fail. For example, "fail" likely doesn't exist and will trigger an error.
  const output = await $`fail`.nothrow();  // no .quiet() here, but .nothrow() is set

  // Because we didn't call .quiet(), the error should have been printed to stderr
  // and because we used .nothrow(), the promise should resolve instead of rejecting.
  assert.equal(output.success, false, 'Should not succeed');
  assert.notEqual(output.exitCode, 0, 'Exit code should be 127');
  // By reaching here without throwing an error, we've covered resolve(final).
  // And by not using quiet, we covered console.error(err).
});

// Note: Don't call .quiet() here, and do call .nothrow().
// This ensures console.error(err) and resolve(final) will run.
test.it('should trigger onError with console.error and resolve(final)', async () => {
  const output = await $`echo hello`
    .shell('/nonexistent-shell-xyz') // A shell that does not exist
    .nothrow(); // No .quiet() so console.error runs, .nothrow() so resolve(final) runs

  assert.equal(output.success, false, 'Should not succeed');
  assert.equal(output.exitCode, 1, 'Exit code should be 1');
});
