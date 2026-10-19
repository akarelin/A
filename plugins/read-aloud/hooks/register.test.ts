import { expect, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 9 }, view: {} },
} as const

test('the band shows the read-aloud button on every surface', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'read-aloud', surface, ...BAND })
    expect((await ui.find({ key: 'read-aloud' }))?.type).toBe('Button')
    await ui.unmount()
  }
})

test('a press speaks the spoken version of the last reply', async ($, on) => {
  const spoken: string[][] = []
  const usage = { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
  on('model.fork', ($, e) => ({ value: { isAnswered: true, text: `spoken: ${e.prompt.includes('the reply text') && e.prompt.includes('## What to say')}`, usage } }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('process.run', ($, e) => {
    spoken.push([...e.argv])
    return { value: { exitCode: 0, stdout: '', stderr: '' } }
  })
  on('fs.read', () => ({ value: '## What to say' }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', ($, e) => {
    throw new Error(`toast: ${JSON.stringify(e)}`)
  })
  await $.turn.complete({ answer: 'the reply text', reason: 'answer' } as never)
  const ui = await $.ui.mount({ plugin: 'read-aloud', surface: 'terminal', ...BAND })
  await ui.press({ key: 'read-aloud' })
  expect(spoken.at(-1)?.at(-1)).toBe('spoken: true')
  await ui.unmount()
})

test('a press returns at once and the speech goes on after it', async ($, on) => {
  const usage = { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
  const toasts: string[] = []
  let done = false
  on('model.fork', () => ({ value: { isAnswered: true, text: 'spoken', usage } }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('process.run', async () => {
    await new Promise(r => setTimeout(r, 2000))
    done = true
    return { value: { exitCode: 0, stdout: '', stderr: '' } }
  })
  on('fs.read', () => ({ value: '## What to say' }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', ($, e) => {
    toasts.push(JSON.stringify(e))
    return { value: undefined }
  })
  await $.turn.complete({ answer: 'the reply text', reason: 'answer' } as never)
  const ui = await $.ui.mount({ plugin: 'read-aloud', surface: 'terminal', ...BAND })
  await ui.press({ key: 'read-aloud' })
  expect(done).toBe(false)
  await new Promise(r => setTimeout(r, 2500))
  expect(toasts).toEqual([])
  expect(done).toBe(true)
  await ui.unmount()
})
