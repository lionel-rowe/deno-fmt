# `deno-fmt` [![JSR](https://jsr.io/badges/@li/deno-fmt)](https://jsr.io/@li/deno-fmt)

A TransformStream that formats the input using `deno fmt`. Requires `--allow-run` permissions to spawn the `deno fmt` subprocess. It spawns a `deno fmt` subprocess and pipes the input to its stdin, and the output from its stdout.

## DenoFmtStream

```ts
import { DenoFmtStream } from '@li/deno-fmt'
import { assertEquals } from '@std/assert'
const input = 'let   x=\n\t1;;;\n++x'
const stream = new Blob([input])
	.stream()
	.pipeThrough(new DenoFmtStream({ config: null }))
const output = await new Response(stream).text()
assertEquals(output, 'let x = 1;\n++x;\n')
```

## denoFmt

For convenience with string inputs and outputs, you can also use the `denoFmt` function.

```ts
import { denoFmt } from '@li/deno-fmt'
import { assertEquals } from '@std/assert'
const input = 'let   x=\n\t1;;;\n++x'
const output = await denoFmt(input, { config: null })
assertEquals(output, 'let x = 1;\n++x;\n')
```
