# Russian voice input for DeepSeek Harness: bolting Whisper onto the built-in microphone button

*How an open-source agent environment learned to understand Russian speech without sending a single second of audio to the cloud.*

## The problem

DeepSeek Harness (DSH) is an open-source agent environment: a terminal, files, plugins, a model. The composer has a
microphone button, and it works honestly — for Chinese, English, Japanese, Korean and Cantonese. Under the hood sits
SenseVoice, and Russian is not in its language set at all.

In practice it looks like this. You speak Russian and get `"As a piece goes through."` or some Latin gibberish. Not
because the microphone is bad, but because the model decided the language was English.

The requirement was simple: make the button understand Russian. I set the constraints up front:

- local only, no cloud and no API keys;
- no second app — same button, same interface;
- one-line install, no manual Python environment assembly.

## How voice input works in DSH

DSH has a `speechToText` service: a registry of recognition providers. The client side does not know who transcribes.
It records WAV, hands the bytes to a provider, and inserts the returned text into the composer.

The provider interface is minimal:

```js
{
  info: { id, name, location: 'host-local', languages: [...] },
  transcribe({ audio, language }, signal) -> { text, audioSeconds, inferenceSeconds }
}
```

So all you need is to register your provider and return text. The interface, the button, the settings and the
language persistence already exist. That simplifies things a lot: the plugin does not draw UI, it swaps the engine.

Whisper fits this description perfectly: MIT licence for both code and weights, about a hundred languages, excellent
Russian, runs on CPU.

## A Whisper provider

The plugin calls itself EchoRUS. Three parts inside:

1. `index.js` — registers the `echorus-local` provider, finds Python, installs dependencies, downloads the model.
2. `python/echorus_stt.py` — one transcription call: WAV in, JSON out.
3. `cordis.patch.yml` — the plugin row and the default provider selection.

Recognition is `faster-whisper` on top of CTranslate2, model `large-v3-turbo` in int8.

```js
const model = new WhisperModel(modelPath, { device: 'cpu', compute_type: 'int8' })
const segments = model.transcribe(wav, { language: 'ru', beam_size: 5, vad_filter: true })
```

## Installation without pain

The first version worked only on my machine: absolute paths to Python and to the model folder. That is useless for
anyone else, so a bootstrap appeared:

1. **Find Python.** `ECHORUS_PYTHON`, then `python3`/`python` from PATH, then the usual install locations. The version
   is checked — 3.9+ is required.
2. **Install packages.** `pip install --target` into the plugin data directory. No virtual environment: `venv` on
   Windows regularly stumbles on `ensurepip`, while `--target` always works.
3. **Download the model** into a plain folder rather than the Hugging Face cache.

All of it is wired into "preparation" — the built-in DSH mechanism that shows progress in the voice input panel. The
user sees what is happening and can cancel it.

## What did not work

Two problems cost an evening.

**First: the download hung.** A 1.5 GB model started and froze at 3.6 MB. The process was alive, CPU was ticking,
bytes were not moving. The cause is Hugging Face's Xet transport: on some networks it never comes up and waits
silently. One variable fixes it, `HF_HUB_DISABLE_XET=1`, after which the same 1.5 GB arrived in 159 seconds.

**Second: the model took twice the disk.** The Hugging Face cache lays files out as symlinks by default, and on
Windows without Developer Mode there are no symlinks — so the cache physically duplicates the weights. 3 GB instead
of 1.5. Downloading into a plain folder removes the issue.

It also turned out that the cache check at startup goes to the network and hits Xet again. Had to set
`HF_HUB_OFFLINE=1` for the recognition step: the model is already on disk, the network is not needed.

## Benchmarks

Hardware: an ordinary laptop CPU, no GPU.

| Model | Load | 29 s of audio | RTF | Russian |
|---|---|---|---|---|
| `large-v3-turbo` | 3.3 s | 5.8 s | 0.20 | alphabet recognised |
| `large-v3` | 4.8 s | 13.4 s | 0.47 | "ababagady yuzhzy" |

The conclusion surprised me: the larger model is **worse**. On an unintelligible fragment `large-v3` confidently
invents coherent text, while `large-v3-turbo` honestly gives up the structure. Speed differs threefold. `turbo` is
the default.

Live dictation: 16 seconds of speech — 8.4 seconds to text, including model load.

## Proper nouns

A separate pain is names. "Kubernetes", "Postgres", "Grafana" sound Russian when spoken in Russian, and the model
writes them in Cyrillic. You want Latin spelling.

The first approach is a **glossary** (`hotwords` in faster-whisper): we feed the model a list of terms. Names came
out right (`Kubernetes`, `PostgreSQL`), but **all punctuation disappeared** — the model stopped placing full stops
and commas.

The second approach is a **context prompt** (`initial_prompt`): "This is a work dictation in Russian. Write with
punctuation and capitalisation." Better result: punctuation, capitals and `PostgreSQL` all at once.

The third and most reliable one is a **replacement dictionary** applied after recognition:

```yaml
replacements: Кубернетес=Kubernetes, Постгрес=PostgreSQL, Нжинкс=Nginx
```

Whole-word replacement, case-insensitive: both "кубернетес" and "Кубернетес" become `Kubernetes`. Inflected forms
("Кубернетеса") are deliberately untouched — otherwise you would get `Kubernetesа`, a mix of two alphabets.

Conclusion: do not teach the model to detect the language of each word. Substitute the spelling deterministically.

## Defaults

- Model `large-v3-turbo`, language `ru`, CPU, int8.
- Context prompt about work dictation with punctuation.
- Empty glossary and empty replacement dictionary — everyone adds their own terms.

## Privacy

Audio is recorded by the browser, handed to a local process, recognised locally and deleted right after
transcription. The only outbound traffic is downloading packages and the model on first install. After that,
recognition works offline — you can unplug the network and check.

## Limitations

- CPU only. GPU is not used, although `faster-whisper` supports it.
- The model loads on every request: 3–4 seconds added to every phrase. A persistent worker would remove that, but it
  does not exist yet.
- First install is about 2 GB and a few minutes.
- No speaker separation and no manual punctuation editing.

## Install

```
Plugins → Discover → Add index → https://shtazi98.github.io/echorus-voice/index.json
```

Then the EchoRUS card in the catalogue and the Install button. Without the catalogue:

```
Plugins → Add plugin → github:Shtazi98/echorus-voice
```

Sources: [github.com/Shtazi98/echorus-voice](https://github.com/Shtazi98/echorus-voice). MIT.

## What's next

1. A persistent worker process: drop model load from every request.
2. Automatic normalisation of numbers and dates.
3. Voice replies — right now only input works.

If you have a similar problem, try it and tell me what the model hears for you. "The model confidently invents
text" is the kind of list worth collecting together.
