#!/usr/bin/env python3
"""Exporta as leituras persistidas de um sensor pela API, no CSV lido pelo `entrega.py`.

Alternativa ao `\\copy` no banco do servidor: usa `GET /api/sensores/{id}/leituras`, que
devolve as leituras dos últimos `--minutos` (máximo 240 no backend) — rode até 4 h depois
do teste. Colunas: sensor_id, sequencia, timestamp_leitura, recebido_em.

A senha vem de TCC_SINDICO_SENHA ou é pedida no terminal (não fica no histórico do shell).

Uso:
    python3 docs/scripts/analise/exportar_leituras.py docs/resultados/leituras-estavel.csv \\
        --sensor a3e7cb03-0acb-42a6-8adc-a5038a4e674d --minutos 120

Só usa a biblioteca padrão do Python.
"""

import argparse
import csv
import getpass
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


def requisitar(metodo, url, corpo=None, token=None):
    cabecalhos = {"Content-Type": "application/json"}
    if token:
        cabecalhos["Authorization"] = f"Bearer {token}"
    dados = json.dumps(corpo).encode() if corpo is not None else None
    pedido = urllib.request.Request(url, data=dados, headers=cabecalhos, method=metodo)
    try:
        with urllib.request.urlopen(pedido, timeout=30) as resposta:
            return json.load(resposta)
    except urllib.error.HTTPError as erro:
        sys.exit(f"{metodo} {url} -> {erro.code}: {erro.read().decode(errors='replace')}")


def main():
    parser = argparse.ArgumentParser(description="Exporta leituras de um sensor (CSV do entrega.py).")
    parser.add_argument("arquivo", help="CSV de saída")
    parser.add_argument("--sensor", required=True, help="sensorId (UUID)")
    parser.add_argument("--minutos", type=int, default=240, help="janela até agora (máximo 240)")
    parser.add_argument("--api", default="https://apitcc.bernardoburigo.com.br")
    parser.add_argument("--email", default="sindico@bernardoburigo.com.br")
    args = parser.parse_args()

    api = args.api.rstrip("/")
    senha = os.environ.get("TCC_SINDICO_SENHA") or getpass.getpass(f"senha de {args.email}: ")
    token = requisitar("POST", f"{api}/api/auth/login", {"email": args.email, "senha": senha})["token"]
    leituras = requisitar("GET", f"{api}/api/sensores/{args.sensor}/leituras?minutos={args.minutos}", token=token)

    caminho = Path(args.arquivo)
    caminho.parent.mkdir(parents=True, exist_ok=True)
    with caminho.open("w", newline="", encoding="utf-8") as saida:
        escritor = csv.writer(saida)
        escritor.writerow(["sensor_id", "sequencia", "timestamp_leitura", "recebido_em"])
        for leitura in leituras:
            escritor.writerow([leitura["sensorId"], leitura["sequencia"], leitura["timestampLeitura"], leitura["recebidoEm"]])
    if leituras:
        print(f"{len(leituras)} leituras ({leituras[0]['timestampLeitura']} .. {leituras[-1]['timestampLeitura']}) em {caminho}")
    else:
        print(f"nenhuma leitura nos últimos {args.minutos} min; {caminho} só com o cabeçalho")


if __name__ == "__main__":
    main()
