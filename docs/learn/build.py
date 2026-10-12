"""Transforme une leçon Markdown de docs/learn/ en PDF.

Utilisation :
    pip install -r docs/learn/requirements.txt
    python3 docs/learn/build.py docs/learn/00-le-socle.md

Le PDF est écrit à côté du fichier Markdown, avec le même nom.

Syntaxe disponible dans les leçons :
- les titres, listes, tableaux et liens Markdown habituels ;
- du code coloré avec un titre :  ```ts title="apps/api/src/app.ts"
- des encadrés :  !!! note "Analogie"   /   !!! tip "À retenir"   /   !!! warning "Piège"
  (le contenu de l'encadré est indenté de 4 espaces sur les lignes suivantes).
"""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

import markdown
from pygments.formatters import HtmlFormatter
from weasyprint import HTML

ACCENT = "#B87A00"

CSS = f"""
@page {{
  size: A4;
  margin: 22mm 20mm 22mm 20mm;
  @bottom-right {{
    content: counter(page) " / " counter(pages);
    font: 8.5pt Inter, sans-serif; color: #8a7d68;
  }}
  @bottom-left {{
    content: string(lesson-title);
    font: 8.5pt Inter, sans-serif; color: #8a7d68;
  }}
}}
@page :first {{ @bottom-left {{ content: none; }} }}

html {{ font-family: Inter, "DejaVu Sans", sans-serif; font-size: 10.4pt; color: #1f1a12; }}
body {{ line-height: 1.55; }}

h1 {{
  string-set: lesson-title content();
  font-size: 25pt; line-height: 1.15; margin: 0 0 4mm; letter-spacing: -0.02em;
}}
.kicker {{
  font-size: 9pt; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
  color: {ACCENT}; margin-bottom: 3mm;
}}
.meta {{ color: #6b5e4a; font-size: 9.5pt; margin-bottom: 8mm; }}
h2 {{
  font-size: 15pt; margin: 9mm 0 3mm; padding-top: 3mm; border-top: 1.5px solid #eadfc8;
  page-break-after: avoid;
}}
h3 {{ font-size: 11.5pt; margin: 6mm 0 2mm; page-break-after: avoid; }}
p, li {{ orphans: 3; widows: 3; }}
ul, ol {{ padding-left: 5.5mm; }}
li {{ margin: 1mm 0; }}
strong {{ font-weight: 650; }}
a {{ color: {ACCENT}; text-decoration: none; }}

code {{
  font-family: "DejaVu Sans Mono", monospace; font-size: 8.6pt;
  background: #f6efe2; padding: 0.3mm 1mm; border-radius: 2px;
}}
.highlight, pre {{ page-break-inside: avoid; }}
.highlight {{ margin: 3mm 0 4mm; }}
.highlight .filename {{
  display: block; font-family: "DejaVu Sans Mono", monospace; font-size: 7.8pt; color: #6b5e4a;
  background: #efe6d4; padding: 1.5mm 3mm; border-radius: 3px 3px 0 0;
}}
.highlight pre {{
  margin: 0; padding: 3mm 3.5mm; background: #fbf7ee; border-left: 2.5px solid {ACCENT};
  border-radius: 0 0 3px 3px; white-space: pre-wrap; word-break: break-word;
  font-size: 8.4pt; line-height: 1.5;
}}
.highlight pre code {{ background: none; padding: 0; font-size: inherit; }}

table {{ border-collapse: collapse; width: 100%; margin: 3mm 0 5mm; font-size: 9.4pt; }}
th, td {{ border-bottom: 1px solid #eadfc8; padding: 1.8mm 2mm; text-align: left; vertical-align: top; }}
th {{ font-weight: 650; background: #f6efe2; }}

.admonition {{
  margin: 4mm 0; padding: 3mm 4mm; border-radius: 4px; page-break-inside: avoid;
  background: #f4f1ea; border-left: 3px solid #8a7d68;
}}
.admonition-title {{ font-weight: 700; margin: 0 0 1mm; font-size: 9.6pt; }}
.admonition p:last-child {{ margin-bottom: 0; }}
.admonition.note {{ background: #eef4fb; border-left-color: #3b6ea8; }}
.admonition.note .admonition-title {{ color: #2c5788; }}
.admonition.tip {{ background: #fcefd2; border-left-color: {ACCENT}; }}
.admonition.tip .admonition-title {{ color: #8a5c00; }}
.admonition.warning {{ background: #fbeceb; border-left-color: #b4433a; }}
.admonition.warning .admonition-title {{ color: #93352d; }}
"""


def render(source: Path) -> Path:
    text = source.read_text(encoding="utf-8")
    body = markdown.markdown(
        text,
        extensions=[
            "admonition",
            "tables",
            "pymdownx.superfences",
            "pymdownx.highlight",
        ],
        extension_configs={
            "pymdownx.highlight": {"use_pygments": True, "css_class": "highlight"},
        },
    )
    # Couleurs du code : le thème « friendly » de Pygments, sobre et lisible à l'impression.
    pygments_css = HtmlFormatter(style="friendly").get_style_defs(".highlight")
    html = f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<style>{CSS}{pygments_css}</style></head>
<body>
<div class="kicker">Ruche · leçon</div>
{body.replace("</h1>", f'</h1><div class="meta">Généré le {date.today():%d/%m/%Y}</div>', 1)}
</body></html>"""
    output = source.with_suffix(".pdf")
    HTML(string=html, base_url=str(source.parent)).write_pdf(output)
    return output


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage : python3 docs/learn/build.py docs/learn/<leçon>.md")
    print(render(Path(sys.argv[1])))
