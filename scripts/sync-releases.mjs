#!/usr/bin/env node
/**
 * Sync docs/releases.json → App shared + TalkNow site releases-data.js
 * Site SoT: lizhenning.com/other/typenow/js/releases-data.js
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'docs/releases.json')
const raw = readFileSync(src, 'utf8').trim()
JSON.parse(raw) // validate

const jsBody = `window.TALKNOW_RELEASES = ${raw}\n`

const sharedJson = join(root, 'src/shared/releases.json')
writeFileSync(sharedJson, raw.endsWith('\n') ? raw : raw + '\n', 'utf8')
console.log('Wrote', sharedJson)

const mirrorJson = join(root, 'website/releases.json')
if (existsSync(dirname(mirrorJson))) {
  writeFileSync(mirrorJson, raw.endsWith('\n') ? raw : raw + '\n', 'utf8')
  console.log('Wrote', mirrorJson, '(legacy mirror)')
}

const dests = [
  join(root, '../../lizhenning.com/other/typenow/js/releases-data.js'),
  join(root, 'website/js/releases-data.js'),
]

let wrote = 0
for (const dest of dests) {
  const dir = dirname(dest)
  if (!existsSync(dir)) {
    console.warn('Skip (missing dir):', dest)
    continue
  }
  mkdirSync(dir, { recursive: true })
  writeFileSync(dest, jsBody, 'utf8')
  console.log('Wrote', dest)
  wrote += 1
}

if (!wrote) {
  console.error('No releases-data.js destinations written')
  process.exit(1)
}
