import * as assert from 'node:assert';
import { $ } from './index.js';

{
  // should echo hello world
  const env = {
    hello: "world"
  }
  const result = $`echo $hello`
  const text = await result.env(env).quiet().text()
  assert.equal(text, 'world\n')
  console.log("Success 1")
}
{
  // should fail quietly
  const result = await $`fail`.nothrow().quiet().text()
  assert.equal(result, '')
  console.log("Success 2")
}
{
  // should fail loudly
  let result: string | undefined = undefined
  try {
    result = await $`fail`.quiet().text()
    assert.equal("THIS LINE SHOULD NOT BE REACHED", "")
  } catch (e) {
    const expected1 = '/bin/sh: fail: command not found\n'
    const expected2 = '/bin/sh: 1: fail: not found\n'
    const msg = (e as Error).message
    assert.equal(msg === expected1 || msg === expected2, true)
    assert.equal(result, undefined)
  }
  console.log("Success 3")
}
{
  // should return json
  const json = await $`echo '{"hello":"world"}'`.quiet().json()
  assert.deepEqual(json, { hello: 'world' })
  console.log("Success 4")
}
{
  // should return array buffer
  const buffer = await $`echo hello`.quiet().arrayBuffer()
  assert.equal(buffer.constructor.name, 'ArrayBuffer')
  console.log("Success 5")
}
{
  // should be possible to await directly
  const output = await $`echo hello`.quiet()
  assert.equal(output.stdout, 'hello\n')
  console.log("Success 6")
}
