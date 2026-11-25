"""EchoRUS: one transcription call. WAV in, one JSON line out.

The host runs this with PYTHONPATH pointing at the data directory that holds
faster-whisper, so no virtual environment is required.

  {"text": "...", "language": "ru", "audio_seconds": 12.3, "inference_seconds": 4.5}
"""
import argparse
import json
import sys
import time


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    parser = argparse.ArgumentParser()
    parser.add_argument("wav")
    parser.add_argument("--model-path", required=True, help="local directory holding the CTranslate2 model")
    parser.add_argument("--lang", default="ru")
    parser.add_argument("--hotwords", default=None, help="comma-separated terms to bias recognition")
    parser.add_argument("--prompt", default=None, help="free-text context hint")
    args = parser.parse_args()

    from faster_whisper import WhisperModel

    language = None if args.lang in ("auto", "", None) else args.lang
    started = time.time()
    model = WhisperModel(args.model_path, device="cpu", compute_type="int8", local_files_only=True)
    hotwords = None
    if args.hotwords:
        hotwords = " ".join(part.strip() for part in args.hotwords.split(",") if part.strip())
    segments, info = model.transcribe(
        args.wav,
        language=language,
        beam_size=5,
        vad_filter=True,
        condition_on_previous_text=False,
        hotwords=hotwords,
        initial_prompt=args.prompt,
    )
    parts = [segment.text.strip() for segment in segments if segment.text.strip()]
    elapsed = time.time() - started

    print(json.dumps({
        "text": " ".join(parts).strip(),
        "language": info.language,
        "audio_seconds": round(float(info.duration or 0.0), 2),
        "inference_seconds": round(elapsed, 2),
    }, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
