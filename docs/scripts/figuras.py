#!/usr/bin/env python3
"""Monta as figuras compostas do artigo a partir das capturas/fotos em `docs/figuras/`.

Figura 2 (telas do app): capturas do celular lado a lado, alinhadas pelo topo, com o fundo vazio
abaixo do conteúdo recortado, largura comum, borda cinza clara (o fundo do app é quase branco) e
as letras (a), (b), (c) embaixo. Figura 3 (bancada): fotos recortadas na mesma altura, lado a lado.

Para trocar um painel (ex.: refazer o (b) depois da calibração), basta substituir o arquivo de
origem e rodar de novo:

    docs/scripts/analise/.venv/bin/python docs/scripts/figuras.py

Requer Pillow (já vem com o matplotlib da venv de análise).
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

PASTA = Path(__file__).resolve().parent.parent / "figuras"

FIGURA2 = ["condominio-coord.jpg", "apto-coord.jpg", "condominio-prop.jpg"]
# (arquivo, recorte (esq, topo, dir, base) em fração da foto já rotacionada)
FIGURA3 = [
    ("20261024_100409.jpg", (0.04, 0.12, 1.00, 0.86)),
    ("20261028_175937.jpg", (0.10, 0.18, 0.90, 0.86)),
]

LARGURA_TELA = 720
ALTURA_FOTO = 900
ESPACO = 48
MARGEM_LETRA = 90
BORDA = (203, 213, 225)
BRANCO = (255, 255, 255)


def fonte(tamanho):
    for nome in ("DejaVuSans.ttf", "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "LiberationSans-Regular.ttf"):
        try:
            return ImageFont.truetype(nome, tamanho)
        except OSError:
            continue
    return ImageFont.load_default(tamanho)


def abrir(nome):
    return ImageOps.exif_transpose(Image.open(PASTA / nome)).convert("RGB")


def recortar_fundo(tela, folga=40):
    """Corta as linhas finais iguais ao fundo (cor do canto inferior), deixando uma folga."""
    fundo = tela.getpixel((tela.width // 2, tela.height - 1))
    cinza = tela.convert("L")
    referencia = sum(fundo) / 3
    base = tela.height
    for y in range(tela.height - 1, 0, -1):
        linha = cinza.crop((0, y, tela.width, y + 1)).getextrema()
        if abs(linha[0] - referencia) > 6 or abs(linha[1] - referencia) > 6:
            base = y + 1
            break
    return tela.crop((0, 0, tela.width, min(tela.height, base + folga)))


def com_borda(imagem, espessura=2):
    return ImageOps.expand(imagem, border=espessura, fill=BORDA)


def lado_a_lado(paineis, caminho):
    letra = fonte(44)
    largura = sum(p.width for p in paineis) + ESPACO * (len(paineis) - 1)
    altura = max(p.height for p in paineis) + MARGEM_LETRA
    figura = Image.new("RGB", (largura, altura), BRANCO)
    desenho = ImageDraw.Draw(figura)
    x = 0
    for i, painel in enumerate(paineis):
        figura.paste(painel, (x, 0))
        texto = f"({chr(ord('a') + i)})"
        caixa = desenho.textbbox((0, 0), texto, font=letra)
        desenho.text((x + (painel.width - (caixa[2] - caixa[0])) / 2, altura - MARGEM_LETRA + 18),
                     texto, fill=(0, 0, 0), font=letra)
        x += painel.width + ESPACO
    figura.save(caminho, dpi=(300, 300))
    print(f"{caminho.name}: {figura.width}x{figura.height}")


def figura2():
    paineis = []
    for nome in FIGURA2:
        tela = recortar_fundo(abrir(nome))
        tela = tela.resize((LARGURA_TELA, round(tela.height * LARGURA_TELA / tela.width)), Image.LANCZOS)
        paineis.append(com_borda(tela))
    lado_a_lado(paineis, PASTA / "figura2-composta.png")


def figura3():
    paineis = []
    for nome, (e, t, d, b) in FIGURA3:
        foto = abrir(nome)
        foto = foto.crop((round(e * foto.width), round(t * foto.height), round(d * foto.width), round(b * foto.height)))
        foto = foto.resize((round(foto.width * ALTURA_FOTO / foto.height), ALTURA_FOTO), Image.LANCZOS)
        paineis.append(foto)
    lado_a_lado(paineis, PASTA / "figura3-bancada.png")


if __name__ == "__main__":
    figura2()
    figura3()
