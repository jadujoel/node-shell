{
  const result = await Bun.build({
    entrypoints: ['index.ts', "test.ts"],
    outdir: '.',
    sourcemap: 'inline',
    target: 'node',
    minify: true
  })

  if (!result.success) {
    console.error(result.logs)
    process.exit(1)
  }
}
{
  const result = await Bun.build({
    entrypoints: ["test.ts"],
    outdir: '.',
    sourcemap: 'none',
    minify: false,
    target: 'node',
    // external: ['node:assert', 'node:child_process']
  })
  if (!result.success) {
    console.error(result.logs)
    process.exit(1)
  }
}
