import ansiRegex from 'ansi-regex'

/** Options for {@linkcode DenoFmtStream} */
export type DenoFmtStreamOptions = {
	/**
	 * Path to a Deno configuration file.
	 * - If unset, the currently active config file is used.
	 * - If explicitly set to `null`, the default config is used.
	 */
	config?: string | null
	/**
	 * Use the default file type detection based on extension.
	 */
	fileName?: string
	/**
	 * Override the file type detection based on extension.
	 * @default {'ts'}
	 */
	ext?: Ext
}

// deno-fmt-ignore
type Ext =
	| 'ts' | 'tsx' | 'js' | 'jsx' | 'mts' | 'mjs' | 'cts' | 'cjs' | 'md'
	| 'json' | 'jsonc' | 'css' | 'scss' | 'sass' | 'less' | 'html' | 'svelte'
	| 'vue' | 'astro' | 'yml' | 'yaml' | 'ipynb' | 'sql' | 'vto' | 'njk'

/**
 * A TransformStream that formats the input using `deno fmt`.
 * Requires `--allow-run` permissions to spawn the `deno fmt` subprocess.
 *
 * @example
 * ```ts
 * import { assertEquals } from '@std/assert'
 *
 * const input = 'let   x=\n\t1;;;\n++x'
 * const stream = new Blob([input])
 * 	.stream()
 * 	.pipeThrough(new DenoFmtStream({ config: null }))
 * const output = await new Response(stream).text()
 * assertEquals(output, 'let x = 1;\n++x;\n')
 * ```
 */
export class DenoFmtStream extends TransformStream<Uint8Array, Uint8Array> {
	constructor(options?: DenoFmtStreamOptions) {
		let ext: string | null = options?.ext ?? null
		const ac = new AbortController()

		if (ext == null) {
			if (options?.fileName == null) {
				ext = 'ts'
			} else {
				const m = options?.fileName?.match(/(?<=\.)\w+$/)?.[0]
				if (m == null) {
					throw new Error(`Could not determine extension from file name '${options.fileName}'`)
				}
				ext = m
			}
		}

		const args = ['fmt']
		args.push('--ext', ext)
		if (options?.config === null) {
			args.push('--no-config')
		} else if (typeof options?.config === 'string') {
			args.push('--config', options.config)
		}

		// read from stdin
		args.push('-')

		const process = new Deno.Command(
			Deno.execPath(),
			{ args, stdin: 'piped', stdout: 'piped', stderr: 'piped' },
		).spawn()

		const stdin = process.stdin.getWriter()
		const stdout = process.stdout.getReader()

		super({
			start(controller) {
				queueUntilDone(stdout, controller, ac.signal)
			},
			transform(chunk) {
				stdin.write(chunk)
			},
			async flush(controller) {
				ac.abort()
				await Promise.all([
					stdin.close(),
					queueUntilDone(stdout, controller),
				])

				const result = await process.status
				if (!result.success) {
					controller.error(new Error((await new Response(process.stderr).text()).replaceAll(ansiRegex(), '')))
				}

				await stdout.cancel()
				await process.stderr.cancel()
			},
		})
	}
}

async function queueUntilDone(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	controller: TransformStreamDefaultController<Uint8Array>,
	signal?: AbortSignal,
) {
	while (true) {
		const read = await reader.read()
		if (read.done) break
		controller.enqueue(read.value)
		if (signal?.aborted) break
	}
}
