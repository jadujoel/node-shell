import * as childProcess from 'node:child_process'
interface ShellOutput { stdout: string, stderr: string, success: boolean }

/// template string function
export function $(strings: TemplateStringsArray, ...keys: string[]) {
  return run(strings.reduce((acc, str, i) => {
    return acc + str + (keys[i] ?? '')
  }, ''))
}


/**
 * @param {string} command
 * @returns {Promise<>}
 */
export function run(command: string) {
  const state = {
    quiet: false,
    nothrow: false,
    closed: false
  }
  const result = {
      success: true,
      stdout: "",
      stderr: ""
  }
  const createPromise = () => new Promise((resolve, reject) => {
    const child = childProcess.exec(command)
    child.stdout?.on('data', (data) => {
      const str = data.toString()
      result.stdout += str
      if (!state.quiet) {
        process.stdout.write(str)
      }
    })
    child.stderr?.on('data', (data) => {
      const str = data.toString()
      result.stderr += str
      if (!state.quiet) {
        process.stderr.write(str)
      }
    });
    child.on('error', (err) => {
      console.log(`CHILD ERROR: ${err}`)
      const str = err.toString()
      result.stderr += str
      result.success = false
      if (!state.quiet) {
        process.stderr.write(str)
      }
      if (state.nothrow) {
        resolve(result)
      } else {
        throw err
      }
    })
    child.stdout?.on('close', () => {
      if (state.closed) {
        return
      }
      state.closed = true
      if (child.exitCode === 0) {
        resolve(result)
      } else {
        result.success = false
        if (state.nothrow) {
          resolve(result)
        } else {
          reject(new Error(result.stderr))
        }
      }
    })
    child.stderr?.on('close', () => {
      if (state.closed) {
        return
      }
      state.closed = true
      if (child.exitCode === 0 || result.stderr === "") {
        resolve(result)
      } else {
        result.success = false
        if (state.nothrow) {
          resolve(result)
        } else {
          reject(new Error(result.stderr))
        }
      }
    })
  })
  return new class ShellPromise {
    #promise: Promise<ShellOutput> | undefined
    get promise() {
        return this.#promise ?? createPromise()
    }
    quiet() {
        state.quiet = true
        return this
    }
    nothrow() {
        state.nothrow = true
        return this
    }
    env(env: Record<string, string>) {
      Object.assign(process.env, env)
      return this
    }
    async text() {
        return this.promise.then(() => result.stdout)
    }
    async json() {
        return this.promise.then(() => JSON.parse(result.stdout))
    }
    async toString () {
      return this.promise.then(() => result.stdout)
    }
    async arrayBuffer () {
      return this.promise.then(() => Buffer.from(result.stdout).buffer as ArrayBuffer)
    }
    async blob () {
      return this.promise.then(() => new Blob([Buffer.from(result.stdout).buffer as ArrayBuffer]))
    }
  }
}
