import * as assert from 'node:assert';
import { $ } from './index.ts';

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
  let result = undefined
  try {
    result = await $`fail`.quiet().text()
    assert.equal("THIS LINE SHOULD NOT BE REACHED", "")
  } catch (e) {
    assert.equal((e as Error).message, '/bin/sh: fail: command not found\n')
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
  // assert.equal(Buffer.from(buffer).toString(), 'hello\n')
  console.log("Success 5")
}
{
  // should return blob
  const blob = await $`echo hello`.quiet().blob()
  assert.equal(blob.constructor.name, 'Blob')
}

