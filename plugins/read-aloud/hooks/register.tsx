import type { EngineInterface, Register } from 'claude-code'

// Alt+R (keybindings.json binds it to this otherwise idle engine action)
const READ_ACTION = 'app:toggleDiffNoiseFilter'
const PYTHON = 'C:/Users/Alex/.venv/Scripts/python.exe'


let answer = ''
let isSpeaking = false

async function readAloud($: EngineInterface) {
  if (isSpeaking) return
  if (!answer) {
    $.ui.toast('No reply to read yet')
    return
  }
  isSpeaking = true
  try {
    $.ui.status('🔊 Writing the spoken version')
    // read-aloud.md: what to read aloud and how, the prompt the read-aloud skill uses too
    const rules = await $.fs.read(`${$.plugin.root}/read-aloud.md`)
    const spoken = await $.model.fork({ prompt: `${rules}\n\nYour last reply to Alex:\n<reply>\n${answer}\n</reply>` })
    if (!spoken.isAnswered) throw new Error(`no spoken version (${spoken.reason})`)
    $.ui.status('🔊 Speaking')
    // speak.py: the speech model LiteLLM serves says it on the headset
    const said = await $.process.run([PYTHON, `${$.plugin.root}/speak.py`, spoken.text], { timeoutMs: 180000 })
    if (said.exitCode !== 0) throw new Error(said.stderr.trim().split('\n').pop())
  } catch (error) {
    $.ui.toast(`Read aloud failed: ${error}`)
  } finally {
    isSpeaking = false
    $.ui.status(undefined)
  }
}

export const register: Register = on => {
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && e.reason === 'answer' && e.answer.trim()) answer = e.answer
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Button } = $.ui.resolve(e)
    return (
      <Box>
        <Button key="read-aloud" label="🔊 Read aloud · Alt+R" action={READ_ACTION} onPress={() => { void readAloud($) }} />
      </Box>
    )
  })
}
