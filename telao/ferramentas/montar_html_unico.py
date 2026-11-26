"""Junta o Telão num único index.html, para o app Android.

O app Android abre a página com loadDataWithBaseURL, então arquivos separados
(css/, js/, img/) não carregam. Este script coloca o CSS, os scripts e o ícone
dentro do próprio HTML.

Uso:
  python3 ferramentas/montar_html_unico.py <saida/index.html>
"""
import base64
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def ler(rel):
    return (RAIZ / rel).read_text(encoding="utf-8")


def main(saida):
    html = ler("index.html")

    css = ler("css/style.css")
    html = html.replace('<link rel="stylesheet" href="css/style.css">', f"<style>\n{css}\n</style>")

    def script(m):
        src = m.group(1)
        code = ler(src)
        if "</script" in code.lower():
            raise SystemExit(f"ERRO: {src} contém '</script' e quebraria o HTML")
        return f"<script>/* {src} */\n{code}\n</script>"

    html = re.sub(r'<script src="([^"]+)"></script>', script, html)

    icone = "data:image/svg+xml;base64," + base64.b64encode((RAIZ / "img/icon.svg").read_bytes()).decode()
    html = html.replace('href="img/icon.svg"', f'href="{icone}"').replace('src="img/icon.svg"', f'src="{icone}"')
    html = html.replace('  <link rel="manifest" href="manifest.webmanifest">\n', "")

    so_html = re.sub(r"<(script|style)>.*?</\1>", "", html, flags=re.S)
    sobras = re.findall(r'(?:src|href)="(?!https?:|data:|#|mailto:)([^"]+)"', so_html)
    if sobras:
        raise SystemExit(f"ERRO: ainda há arquivos locais referenciados: {sobras}")

    Path(saida).parent.mkdir(parents=True, exist_ok=True)
    Path(saida).write_text(html, encoding="utf-8")
    print(f"{saida}: {len(html.encode()) // 1024} KB")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
