// PostToolUse hook: formats and lints the file Claude just edited.
// Exit code 2 sends the remaining lint errors back to Claude so it fixes them.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const input = JSON.parse(readFileSync(0, 'utf8'))
const file = input?.tool_input?.file_path

if (!file || !/\.(c|m)?(j|t)sx?$|\.json$/.test(file)) process.exit(0)

const result = spawnSync(
  'pnpm',
  ['exec', 'biome', 'check', '--write', '--no-errors-on-unmatched', file],
  { cwd: process.env.CLAUDE_PROJECT_DIR ?? input.cwd, encoding: 'utf8' },
)

if (result.status !== 0) {
  process.stderr.write(result.stdout + result.stderr)
  process.exit(2)
}
