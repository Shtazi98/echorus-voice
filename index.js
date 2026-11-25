/**
 * EchoRUS — local multilingual voice input for DeepSeek Harness.
 *
 * Registers a Whisper-based speech-to-text provider. Everything runs on the host:
 * no API keys, no cloud, no audio leaving the machine. The Python side is
 * bootstrapped on first use (packages into a data directory, model downloaded once).
 */
import { spawn } from 'node:child_process'
import { access, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

export const name = 'echorus-voice'
export const inject = ['speechToText']

/** Tested dependency pair: newer PyAV releases break faster-whisper 1.2.x. */
const PIP_PACKAGES = ['faster-whisper==1.2.1', 'av==13.1.0']
const IS_WIN = process.platform === 'win32'
const PY_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'python', 'echorus_stt.py')

function venvPaths(dataRoot) {
  return {
    pylibs: join(dataRoot, 'pylibs'),
    models: join(dataRoot, 'models'),
    tmp: join(dataRoot, 'tmp'),
  }
}

function run(bin, args, options = {}) {
  const { env, signal, stdin } = options
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
        // The Xet backend stalls behind some networks; plain HTTP works.
        HF_HUB_DISABLE_XET: '1',
        ...env,
      },
    })
    let out = ''
    let err = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { out += chunk })
    child.stderr.on('data', (chunk) => { err += chunk })
    const onAbort = () => { child.kill() }
    if (signal) signal.addEventListener('abort', onAbort, { once: true })
    child.on('error', (error) => {
      if (signal) signal.removeEventListener('abort', onAbort)
      reject(error)
    })
    child.on('close', (code) => {
      if (signal) signal.removeEventListener('abort', onAbort)
      if (signal?.aborted) {
        reject(new Error('cancelled'))
        return
      }
      resolve({ code, stdout: out, stderr: err })
    })
    if (stdin !== undefined) {
      child.stdin.end(stdin)
    } else {
      child.stdin.end()
    }
  })
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function pythonCandidates(configPython) {
  const list = []
  if (configPython) list.push(configPython)
  if (process.env.ECHORUS_PYTHON) list.push(process.env.ECHORUS_PYTHON)
  if (IS_WIN) {
    list.push('python', 'python3', 'py')
    for (const root of [
      join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Python'),
      join(process.env.ProgramFiles ?? '', 'Python'),
    ]) {
      // Discovered below; globbing is async, so candidates are expanded by caller.
      list.push({ dir: root })
    }
  } else {
    list.push('python3', 'python', '/usr/bin/python3', '/opt/homebrew/bin/python3', '/usr/local/bin/python3')
  }
  return list
}

async function expandCandidates(list) {
  const expanded = []
  for (const entry of list) {
    if (typeof entry === 'string') {
      expanded.push(entry)
      continue
    }
    let names = []
    try {
      names = await readdir(entry.dir)
    } catch {
      continue
    }
    for (const name of names.filter((n) => n.startsWith('Python')).sort().reverse()) {
      expanded.push(join(entry.dir, name, IS_WIN ? 'python.exe' : 'bin/python3'))
    }
  }
  return expanded
}

async function workingPython(bin, signal) {
  if (!bin) return undefined
  try {
    const result = await run(bin, ['-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], { signal })
    if (result.code !== 0) return undefined
    const [major, minor] = result.stdout.trim().split('.').map(Number)
    if (major < 3 || (major === 3 && minor < 9)) return undefined
    return bin
  } catch {
    return undefined
  }
}

async function findPython(configPython, signal) {
  const candidates = await expandCandidates(pythonCandidates(configPython))
  for (const candidate of candidates) {
    const found = await workingPython(candidate, signal)
    if (found) return found
  }
  return undefined
}

async function pipReady(python, signal) {
  const result = await run(python, ['-m', 'pip', '--version'], { signal })
  return result.code === 0
}

/**
 * Host-owned readiness state for the speech UI: it explains what the first run
 * is doing and lets the user start or cancel it.
 */
class Preparation {
  constructor(dataRoot, resolvePython, model, log) {
    this.dataRoot = dataRoot
    this.resolvePython = resolvePython
    this.model = model
    this.log = log
    this.state = { phase: 'unprepared' }
    this.listeners = new Set()
    this.task = undefined
    this.controller = undefined
    this.snapshot = this.snapshot.bind(this)
    this.subscribe = this.subscribe.bind(this)
    this.prepare = this.prepare.bind(this)
    this.cancel = this.cancel.bind(this)
    this.refresh = this.refresh.bind(this)
  }

  notify() {
    for (const listener of this.listeners) listener()
  }

  setState(state) {
    this.state = { ...state }
    this.notify()
  }

  snapshot() {
    return this.state
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Inspect installed state without downloading or loading anything. */
  async refresh() {
    const { pylibs, models } = venvPaths(this.dataRoot)
    if (this.task) return
    const python = await this.resolvePython()
    const packages = python !== undefined && (await exists(join(pylibs, 'faster_whisper')))
    const model = await exists(join(models, this.model))
    if (packages && model) {
      this.setState({ phase: 'ready' })
    } else {
      this.setState({ phase: 'unprepared' })
    }
  }

  prepare() {
    if (this.task) return
    this.controller = new AbortController()
    this.task = this.run(this.controller.signal)
      .catch((error) => {
        this.setState({ phase: 'failed', message: error.message })
      })
      .finally(() => {
        this.task = undefined
        this.controller = undefined
      })
  }

  async cancel() {
    this.controller?.abort()
    await this.task
    this.setState({ phase: 'cancelled' })
  }

  async run(signal) {
    const { pylibs, models } = venvPaths(this.dataRoot)
    this.setState({ phase: 'checking', step: 'check', startedAt: Date.now() })

    const python = await this.resolvePython(signal)
    if (!python) {
      throw new Error('Python 3.9+ not found. Install Python or set ECHORUS_PYTHON to its executable.')
    }
    this.log(`EchoRUS: using ${python}`)

    if (!(await pipReady(python, signal))) {
      const boot = await run(python, ['-m', 'ensurepip', '--upgrade'], { signal })
      if (boot.code !== 0) throw new Error('pip is unavailable and ensurepip failed: ' + boot.stderr.trim().slice(-300))
    }

    if (!(await exists(join(pylibs, 'faster_whisper')))) {
      this.setState({ phase: 'downloading', step: 'model', resource: 'python packages', startedAt: Date.now() })
      await mkdir(pylibs, { recursive: true })
      const install = await run(python, [
        '-m', 'pip', 'install', '--disable-pip-version-check', '--no-input',
        '--target', pylibs, ...PIP_PACKAGES,
      ], { signal })
      if (install.code !== 0) {
        throw new Error('Could not install faster-whisper: ' + install.stderr.trim().slice(-500))
      }
    }

    this.setState({ phase: 'downloading', step: 'model', resource: `whisper ${this.model}`, startedAt: Date.now() })
    await mkdir(models, { recursive: true })
    const modelDir = join(models, this.model)
    const download = await run(python, [
      '-c',
      'import sys; from faster_whisper.utils import download_model; download_model(sys.argv[1], output_dir=sys.argv[2])',
      this.model, modelDir,
    ], { env: { PYTHONPATH: pylibs }, signal })
    if (download.code !== 0) {
      throw new Error('Could not download the model: ' + download.stderr.trim().slice(-500))
    }

    this.setState({ phase: 'loading', step: 'load', startedAt: Date.now() })
    const check = await run(python, ['-c', 'import faster_whisper'], { env: { PYTHONPATH: pylibs }, signal })
    if (check.code !== 0) throw new Error('faster-whisper did not import after installation')

    this.setState({ phase: 'ready' })
  }
}

/**
 * @param ctx - cordis context with the speech-to-text registry.
 * @param config - row configuration.
 */
export function apply(ctx, config) {
  const dataRoot = config.dataRoot
  if (typeof dataRoot !== 'string' || !dataRoot) throw new Error('EchoRUS needs an absolute dataRoot')
  const model = config.model ?? 'large-v3-turbo'
  const languages = config.languages ?? ['ru', 'en', 'auto']
  const keepAudio = config.keepAudio === true
  const glossary = typeof config.glossary === 'string' ? config.glossary.trim() : ''
  const customPrompt = typeof config.prompt === 'string' ? config.prompt.trim() : ''
  const autoSetup = config.autoSetup !== false
  const paths = venvPaths(dataRoot)

  const resolvePython = (signal) => findPython(config.pythonPath, signal)
  const preparation = new Preparation(dataRoot, resolvePython, model, (message) => ctx.logger?.info?.(message))

  ctx.effect(() => {
    void (async () => {
      await preparation.refresh()
      if (autoSetup && preparation.snapshot().phase === 'unprepared') preparation.prepare()
    })()
    const unregister = ctx.speechToText.register({
      info: {
        id: 'echorus-local',
        name: 'EchoRUS (Whisper, local)',
        location: 'host-local',
        languages,
        setupEstimate: {
          recommendedDiskBytes: 2_000_000_000,
          expectedMemoryBytes: 1_500_000_000,
          minimumMinutes: 2,
          maximumMinutes: 20,
        },
      },
      preparation,
      async transcribe({ audio, language }, signal) {
        const state = preparation.snapshot()
        if (state.phase !== 'ready') {
          throw new Error('EchoRUS is not ready yet. Open the voice settings and finish setup first.')
        }
        const python = await resolvePython(signal)
        if (!python) throw new Error('Python interpreter not found')

        await mkdir(paths.tmp, { recursive: true })
        const wav = join(paths.tmp, `echorus-${randomUUID()}.wav`)
        await writeFile(wav, audio)
        if (keepAudio) {
          await writeFile(join(paths.tmp, 'last.wav'), audio).catch(() => {})
        }

        try {
          const base = customPrompt || (language === 'ru'
            ? 'Это деловая диктовка на русском языке. Пиши с пунктуацией и заглавными буквами.'
            : 'This is a work dictation. Write with punctuation and correct capitalisation.')
          const extra = ['--prompt', glossary ? `${base} Термины: ${glossary}.` : base]
          const result = await run(python, [
            PY_SCRIPT, wav,
            '--model-path', join(paths.models, model),
            '--lang', language === 'auto' ? 'auto' : language,
            ...extra,
          ], { env: { PYTHONPATH: paths.pylibs, HF_HUB_OFFLINE: '1' }, signal })

          if (result.code !== 0) {
            throw new Error('Whisper failed: ' + result.stderr.trim().slice(-600))
          }
          const line = result.stdout.trim().split('\n').filter(Boolean).pop() ?? ''
          let parsed
          try {
            parsed = JSON.parse(line)
          } catch {
            throw new Error('Whisper returned unreadable output: ' + line.slice(0, 300))
          }
          return {
            text: parsed.text ?? '',
            audioSeconds: Number(parsed.audio_seconds ?? 0),
            inferenceSeconds: Number(parsed.inference_seconds ?? 0),
          }
        } finally {
          await rm(wav, { force: true }).catch(() => {})
        }
      },
    })
    return async () => { await unregister() }
  })
}
