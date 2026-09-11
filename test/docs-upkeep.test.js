import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const ROOT = join(import.meta.dirname, '..')

/**
 * The documentation pairs carry a mandatory-upkeep clause that is easy to satisfy
 * once and then quietly lose. These checks make "someone deleted the clause" or
 * "someone edited one side of a pair" a red test instead of a silent erosion.
 *
 * The hash comparison uses git's own blob hash algorithm (SHA-1 over
 * `blob <len>\0<content>`) so no git process is needed — spawning one is not
 * available in every environment this suite runs in.
 */

/** Bilingual pairs: each side must carry a link to the other. */
const PAIRS = [
  { en: 'README.md', zh: 'README.zh.md' },
  { en: 'DEVELOPMENT.md', zh: 'DEVELOPMENT.zh.md' },
  { en: 'ADAPTATION.md', zh: 'ADAPTATION.zh.md' },
]

/** Documents that must announce the mandatory-upkeep rule. */
const UPKEEP_DOCS = ['DEVELOPMENT.md', 'DEVELOPMENT.zh.md', 'ADAPTATION.md', 'ADAPTATION.zh.md']

function read(name) {
  return readFileSync(join(ROOT, name), 'utf8')
}

/** git blob hash: sha1 of "blob <byteLength>\0" + content. */
function gitBlobHash(text) {
  const body = Buffer.from(text, 'utf8')
  const header = Buffer.from('blob ' + body.length + '\0', 'utf8')
  return createHash('sha1').update(Buffer.concat([header, body])).digest('hex')
}

/** Parse the pairing record into a name -> hash map. */
function recordedHashes() {
  const record = new Map()
  for (const line of read('README.i18n.yaml').split(/\r?\n/)) {
    const match = /^([\w.-]+\.md):\s*([0-9a-f]{40})\s*$/.exec(line.trim())
    if (match !== null) record.set(match[1], match[2])
  }
  return record
}

test('every development document declares the mandatory-upkeep rule', () => {
  for (const name of UPKEEP_DOCS) {
    const text = read(name)
    assert.ok(
      text.includes('<!-- upkeep:required -->'),
      name + ' is missing the upkeep marker (<!-- upkeep:required -->)',
    )
    // The rule must be stated as a requirement, not merely implied.
    assert.match(text, /must update|必须.{0,6}更新/, name + ' does not state the mandatory-update rule')
  }
})

test('each development document points at its counterpart', () => {
  const counterparts = {
    'DEVELOPMENT.md': 'DEVELOPMENT.zh.md',
    'DEVELOPMENT.zh.md': 'DEVELOPMENT.md',
    'ADAPTATION.md': 'ADAPTATION.zh.md',
    'ADAPTATION.zh.md': 'ADAPTATION.md',
  }
  for (const [name, counterpart] of Object.entries(counterparts)) {
    const text = read(name)
    assert.ok(
      text.includes('<!-- pair: ' + counterpart + ' -->'),
      name + ' is missing <!-- pair: ' + counterpart + ' -->',
    )
  }
})

test('every bilingual pair is recorded in README.i18n.yaml and in sync', () => {
  const record = recordedHashes()
  for (const pair of PAIRS) {
    for (const name of [pair.en, pair.zh]) {
      const recorded = record.get(name)
      assert.ok(recorded !== undefined, name + ' has no hash recorded in README.i18n.yaml')
      // A placeholder all-zero hash means "not recorded yet", not "in sync".
      assert.notEqual(recorded, '0'.repeat(40), name + ' still carries a placeholder hash')
      assert.equal(
        gitBlobHash(read(name)),
        recorded,
        name + ' changed without re-recording its hash in README.i18n.yaml (git hash-object ' + name + ')',
      )
    }
  }
})

test('the pairing record lists every markdown document that is part of a pair', () => {
  const record = recordedHashes()
  for (const pair of PAIRS) {
    assert.ok(record.has(pair.en), pair.en + ' missing from README.i18n.yaml')
    assert.ok(record.has(pair.zh), pair.zh + ' missing from README.i18n.yaml')
  }
})

test('the local DSH reference checkout is ignored by git', () => {
  const ignore = read('.gitignore')
  assert.match(ignore, /^dsh\/$/m, '.gitignore must ignore the dsh/ reference folder')
})
