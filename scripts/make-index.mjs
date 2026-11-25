/**
 * Generate docs/index.json — the EchoRUS plugin market index (format 1).
 *
 * Run after every release: node scripts/make-index.mjs
 * It reads the package version and the current commit, so the index always
 * points at code that is actually in the repository.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const repoUrl = 'https://github.com/Shtazi98/echorus-voice'

const index = {
  format: 1,
  title: {
    en: 'EchoRUS — Russian voice input',
    ru: 'EchoRUS — голосовой ввод',
  },
  description: {
    en: 'Local Whisper voice input for DeepSeek Harness. Russian first, any language supported.',
    ru: 'Локальный голосовой ввод на Whisper для DeepSeek Harness. Русский в приоритете, поддержка любого языка.',
  },
  metadata: {
    categories: {
      input: { title: { en: 'Input', ru: 'Ввод' } },
    },
    labels: {
      offline: { title: { en: 'Offline', ru: 'Офлайн' } },
      russian: { title: { en: 'Russian', ru: 'Русский' } },
      speech: { title: { en: 'Speech', ru: 'Речь' } },
    },
  },
  plugins: [
    {
      name: pkg.name,
      title: {
        en: 'EchoRUS voice input',
        ru: 'EchoRUS — голосовой ввод',
      },
      description: {
        en: 'Records from the microphone, transcribes locally with Whisper, inserts the text into the composer. No cloud, no API keys.',
        ru: 'Записывает с микрофона, распознаёт локально через Whisper и вставляет текст в поле ввода. Без облака и API-ключей.',
      },
      icon: 'icon.svg',
      author: 'Shtazi98',
      homepage: `${repoUrl}#readme`,
      repository: { url: repoUrl },
      metadata: {
        category: 'input',
        labels: ['offline', 'russian', 'speech'],
        keywords: ['voice', 'speech', 'whisper', 'russian', 'dictation'],
      },
      versions: [
        {
          version: pkg.version,
          publishTimestamp: Math.floor(Date.now() / 1000),
          source: { type: 'git', url: repoUrl, commit },
          engines: { dsh: pkg.engines.dsh },
        },
      ],
    },
  ],
}

const target = join(root, 'docs', 'index.json')
writeFileSync(target, `${JSON.stringify(index, null, 2)}\n`, 'utf8')
console.log(`wrote ${target} for ${pkg.name}@${pkg.version} at ${commit.slice(0, 7)}`)
