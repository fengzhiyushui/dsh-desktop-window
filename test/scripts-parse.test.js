import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const SCRIPTS = join(import.meta.dirname, '..', 'scripts')
const files = readdirSync(SCRIPTS).filter((name) => name.endsWith('.ps1'))

/**
 * Scripts here run under Windows PowerShell 5.1, whose parser is stricter (and
 * whose diagnostics appear later) than a modern editor's. A parse error is only
 * discovered when a user's window fails to open, so this suite guards them two
 * ways: a static scan that always runs, and a real parser invocation when the
 * environment permits spawning a shell.
 *
 * The static scan exists because the parser invocation cannot run everywhere: in
 * a sandbox that denies piped child stdio (`spawn EPERM`), even
 * `powershell -Command "Write-Output hi"` fails, and a check that cannot run must
 * report itself skipped rather than fail red.
 */

/** Collect files that contain a hazard the static scan can prove. */
function scanForVariableColonTrap() {
  const findings = []
  for (const name of files) {
    const lines = readFileSync(join(SCRIPTS, name), 'utf8').split(/\r?\n/)
    lines.forEach((line, index) => {
      // `"$name: text"` parses the colon as a scope qualifier and is a hard error.
      // Scope and drive qualifiers ($env:, ${script}:, $global:, C:) are fine.
      for (const match of line.matchAll(/\$([A-Za-z_]\w*):/g)) {
        const variable = match[1]
        if (['env', 'script', 'global', 'local', 'private', 'using', 'this'].includes(variable)) continue
        findings.push(name + ':' + (index + 1) + ' -> $' + variable + ':')
      }
    })
  }
  return findings
}

function findPowerShell() {
  for (const executable of ['pwsh', 'powershell']) {
    try {
      execFileSync(executable, ['-NoProfile', '-Command', 'exit 0'], { stdio: 'ignore' })
      return executable
    } catch {
      /* try the next shell */
    }
  }
  return undefined
}

/** Parse every script with PowerShell itself; returns the reported error lines. */
function parseWithPowerShell(shell) {
  const quotedDir = "'" + SCRIPTS.replaceAll("'", "''") + "'"
  const command = [
    '$failed = 0',
    'foreach ($f in Get-ChildItem -LiteralPath ' + quotedDir + ' -Filter *.ps1) {',
    '  $errors = $null; $tokens = $null',
    '  [void][System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$tokens, [ref]$errors)',
    '  foreach ($e in $errors) {',
    // Quote-free assembly: an embedded double quote is re-parsed by the Windows
    // command line before PowerShell ever sees this text.
    "    Write-Output (@($f.Name, $e.Extent.StartLineNumber, $e.Message) -join ' :: ')",
    '    $failed++',
    '  }',
    '}',
    'exit $failed',
  ].join('\n')
  try {
    return { status: 0, output: execFileSync(shell, ['-NoProfile', '-Command', command], { encoding: 'utf8' }) }
  } catch (error) {
    if (error.status === null || error.status === undefined) {
      // Not a script failure: the process could not be started or read at all.
      return { unavailable: String(error.code ?? error.message) }
    }
    return { status: error.status, output: String(error.stdout ?? '') }
  }
}

test('no script contains the PowerShell variable-colon interpolation trap', () => {
  assert.ok(files.length > 0, 'expected at least one .ps1 script')
  assert.deepEqual(scanForVariableColonTrap(), [], 'use ${var} before a colon, not $var:')
})

test('every PowerShell script parses', () => {
  assert.ok(files.length > 0, 'expected at least one .ps1 script')
  const shell = findPowerShell()
  if (shell === undefined) {
    // Skipping is honest here: nothing is verified, and nothing is claimed.
    test.skip('no PowerShell available on PATH')
    return
  }
  const result = parseWithPowerShell(shell)
  if (result.unavailable !== undefined) {
    test.skip('cannot spawn a shell with captured stdio in this sandbox (' + result.unavailable + ')')
    return
  }
  assert.equal(result.status, 0, 'PowerShell parse errors:\n' + result.output.trim())
})
