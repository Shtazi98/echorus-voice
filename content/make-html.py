"""Convert the Habr article body into a formatted HTML page for rich paste.

Habr's visual editor accepts HTML from the clipboard, so the article is rendered
here with semantic tags and no colours: the site keeps its own typography.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "pylibs"))

import markdown  # noqa: E402

body = (HERE / "habr-body.md").read_text(encoding="utf-8")
html_body = markdown.markdown(
    body,
    extensions=["tables", "fenced_code", "sane_lists"],
    output_format="html5",
)

page = f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>EchoRUS — статья для Хабра</title>
<style>
  body {{ max-width: 820px; margin: 40px auto; padding: 0 20px;
         font: 17px/1.65 Georgia, "Times New Roman", serif; color: #000; background: #fff; }}
  h1, h2, h3 {{ font-family: "Segoe UI", Arial, sans-serif; line-height: 1.25; }}
  h2 {{ margin-top: 32px; }}
  pre {{ background: #f4f4f5; padding: 12px 14px; overflow-x: auto;
         font: 14px/1.5 Consolas, monospace; border-radius: 4px; }}
  code {{ font-family: Consolas, monospace; font-size: 0.92em; }}
  table {{ border-collapse: collapse; margin: 16px 0; width: 100%; font-size: 15px; }}
  th, td {{ border: 1px solid #ccc; padding: 6px 10px; text-align: left; vertical-align: top; }}
  th {{ background: #f4f4f5; }}
  blockquote {{ margin: 16px 0; padding-left: 14px; border-left: 3px solid #ccc; color: #333; }}
  li {{ margin-bottom: 6px; }}
</style>
</head>
<body>
{html_body}
</body>
</html>
"""

out = HERE / "habr-article.html"
out.write_text(page, encoding="utf-8")
print(out, len(page))
