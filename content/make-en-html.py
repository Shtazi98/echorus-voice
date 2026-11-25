"""Render the English article into docs/en.html for GitHub Pages."""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE / "pylibs"))

import markdown  # noqa: E402

body = (HERE / "article-en.md").read_text(encoding="utf-8")
html_body = markdown.markdown(body, extensions=["tables", "fenced_code", "sane_lists"], output_format="html5")

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Russian voice input for DeepSeek Harness — EchoRUS</title>
<meta name="description" content="How EchoRUS bolts Whisper onto the built-in microphone button of DeepSeek Harness: local speech recognition, no cloud, no API keys.">
<style>
  :root {{ color-scheme: dark; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; padding: 48px 20px 80px; background: #0b1220; color: #dbe4f0;
         font: 17px/1.7 -apple-system, "Segoe UI", Roboto, sans-serif; }}
  main {{ max-width: 780px; margin: 0 auto; }}
  h1 {{ font-size: 32px; line-height: 1.25; letter-spacing: -0.02em; margin: 0 0 12px; }}
  h2 {{ font-size: 21px; margin: 38px 0 12px; color: #eaf1fc; }}
  p, li {{ color: #cdd9e8; }}
  em {{ color: #9fb2cc; }}
  a {{ color: #6cb2ff; }}
  code, pre {{ font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; }}
  code {{ background: #131d2f; border: 1px solid #22314a; border-radius: 6px; padding: 1px 6px; font-size: 14px; }}
  pre {{ background: #101a2b; border: 1px solid #1e2c44; border-radius: 10px; padding: 14px 16px; overflow-x: auto; }}
  pre code {{ background: none; border: 0; padding: 0; }}
  table {{ border-collapse: collapse; width: 100%; margin: 18px 0; font-size: 15px; }}
  th, td {{ border: 1px solid #22314a; padding: 8px 12px; text-align: left; }}
  th {{ background: #101a2b; }}
  footer {{ margin-top: 56px; color: #6f8099; font-size: 14px; }}
</style>
</head>
<body>
<main>
{html_body}
<footer>
  <a href="./">EchoRUS</a> · <a href="https://github.com/Shtazi98/echorus-voice">source</a> · MIT
</footer>
</main>
</body>
</html>
"""

out = ROOT / "docs" / "en.html"
out.write_text(page, encoding="utf-8")
print(out, len(page))
