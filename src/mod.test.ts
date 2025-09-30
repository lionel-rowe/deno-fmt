import { DenoFmtStream } from './mod.ts'
import { FixedChunkStream } from '@std/streams/unstable-fixed-chunk-stream'
import { assertEquals, assertRejects, assertThrows } from '@std/assert'
import { stub } from '@std/testing/mock'

const TS_INPUT = 'let x=\n\t1;;;\n++x\n'
const TS_EXPECTED = 'let x = 1;\n++x;\n'
const HTML_INPUT = '<A>\n\t  \nxyz   </A>\t'
const HTML_EXPECTED = '<a>\n  xyz\n</a>\n'
const DEFAULT_OPTIONS = { config: null } as const

Deno.test(DenoFmtStream.name, async (t) => {
	await t.step('formats TypeScript input', async () => {
		const input = new Blob([TS_INPUT]).stream()
		const output = await new Response(input.pipeThrough(new DenoFmtStream(DEFAULT_OPTIONS))).text()
		assertEquals(output, TS_EXPECTED)
	})
	await t.step('formats HTML input with ext', async () => {
		const input = new Blob([HTML_INPUT]).stream()
		const output = await new Response(input.pipeThrough(new DenoFmtStream({ ...DEFAULT_OPTIONS, ext: 'html' })))
			.text()
		assertEquals(output, HTML_EXPECTED)
	})
	await t.step('formats HTML input with fileName', async () => {
		const input = new Blob([HTML_INPUT]).stream()
		const output = await new Response(
			input.pipeThrough(new DenoFmtStream({ ...DEFAULT_OPTIONS, fileName: 'a.html' })),
		).text()
		assertEquals(output, HTML_EXPECTED)
	})
	await t.step('throws on unknown fileName extension', async () => {
		const input = new Blob([]).stream()

		await assertRejects(
			() =>
				new Response(
					input.pipeThrough(new DenoFmtStream({ ...DEFAULT_OPTIONS, fileName: 'a.unknown' })),
				).bytes(),
			Error,
			"invalid value 'unknown' for '--ext <ext>'",
		)
	})
	await t.step('throws on fileName with no extension', () => {
		const input = new Blob([]).stream()

		assertThrows(
			() => input.pipeThrough(new DenoFmtStream({ ...DEFAULT_OPTIONS, fileName: 'html' })),
			Error,
			"Could not determine extension from file name 'html'",
		)
	})
	await t.step('chunks of arbitrary length', async () => {
		const INPUT_QUANTITY = 100
		// prime numbers to ensure no alignment
		const INPUT_CHUNK_SIZE = 41
		const STDOUT_CHUNK_SIZE = 37

		const spawn = Deno.Command.prototype.spawn
		using _ = stub(Deno.Command.prototype, 'spawn', function () {
			const result = spawn.call(this)
			const stdout = result.stdout
			Object.defineProperty(
				result,
				'stdout',
				{ value: stdout.pipeThrough(new FixedChunkStream(STDOUT_CHUNK_SIZE)) },
			)
			return result
		})

		const input = new Blob(Array.from({ length: INPUT_QUANTITY }, () => TS_INPUT))
			.stream()
			.pipeThrough(new FixedChunkStream(INPUT_CHUNK_SIZE))

		const output = await new Response(input.pipeThrough(new DenoFmtStream(DEFAULT_OPTIONS))).text()
		assertEquals(output, TS_EXPECTED.repeat(INPUT_QUANTITY))
	})
})
