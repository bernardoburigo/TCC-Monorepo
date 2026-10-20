#!/usr/bin/env python3
"""Taxa de entrega das mensagens (Sprint 6; artigo, Seção 2.6.3, Equação 4, Tabela 6).

    TE = N_rec / N_esp × 100,   N_esp = S_ult − S_prim + 1   (por segmento de boot)

Entradas:
  - leituras.csv: exportado do banco (consulta em README.md), colunas
    sensor_id, sequencia, timestamp_leitura, recebido_em — só leituras PERSISTIDAS, então
    duplicatas rejeitadas (409) nunca entram em N_rec;
  - --serial: log do monitor serial do ESP32 capturado durante a MESMA condição de teste.
    `[FILA] seq=N enfileirada` dá as sequências EMITIDAS (N_esp, inclusive as perdidas no fim)
    e `[POST] seq=N -> 409` as duplicatas rejeitadas (reenvios cuja resposta se perdeu).
    Sem o log, N_esp sai do primeiro/último recebido de cada segmento (perda no fim não aparece).

A `sequencia` zera quando o ESP32 reinicia: cada regressão abre um novo segmento, e a
Equação 4 é aplicada por segmento (o log e o banco precisam ter o mesmo número de boots).

Como o firmware tem fila com reenvio, além da TE o script conta as leituras entregues com
atraso (recebido_em − timestamp_leitura acima de --limiar-atraso, isto é, que esperaram na
fila) e o maior atraso — é isso que distingue "rede estável" de "falhas induzidas".

Uso:
    python3 docs/scripts/analise/entrega.py leituras.csv --serial serial.log \\
        --condicao "Falhas de Wi-Fi induzidas" --saida resultados/tabela6_entrega.csv
"""

import argparse
import re
import sys
from pathlib import Path

import pandas as pd

RE_ENFILEIRADA = re.compile(r"\[FILA\] seq=(\d+) enfileirada")
RE_DUPLICADA = re.compile(r"\[POST\] seq=(\d+) -> 409\b")


def segmentar(sequencias):
    """Divide uma lista de sequências (em ordem de emissão) a cada regressão (= novo boot)."""
    segmentos, atual = [], []
    for seq in sequencias:
        if atual and seq <= atual[-1]:
            segmentos.append(atual)
            atual = []
        atual.append(seq)
    if atual:
        segmentos.append(atual)
    return segmentos


def ler_serial(caminho):
    emitidas, duplicadas = [], 0
    for linha in Path(caminho).read_text(errors="replace").splitlines():
        if m := RE_ENFILEIRADA.search(linha):
            emitidas.append(int(m.group(1)))
        elif RE_DUPLICADA.search(linha):
            duplicadas += 1
    return segmentar(emitidas), duplicadas


def main():
    parser = argparse.ArgumentParser(description="Taxa de entrega por segmento de boot (Equação 4, Tabela 6).")
    parser.add_argument("leituras", help="CSV exportado do banco (sensor_id, sequencia, timestamp_leitura, recebido_em)")
    parser.add_argument("--serial", help="log do monitor serial da mesma condição de teste")
    parser.add_argument("--sensor", help="filtra um sensor_id (obrigatório se o CSV tiver mais de um)")
    parser.add_argument("--desde", help="timestamp_leitura >= (ISO 8601, ex.: 2026-10-28T13:00:00Z)")
    parser.add_argument("--ate", help="timestamp_leitura < (ISO 8601)")
    parser.add_argument("--limiar-atraso", type=float, default=10.0,
                        help="atraso (s) acima do qual a leitura conta como entregue pela fila (padrão 10)")
    parser.add_argument("--condicao", default="", help="rótulo da linha na Tabela 6 (ex.: 'Rede estável')")
    parser.add_argument("--saida", help="CSV onde ACRESCENTAR a linha desta condição")
    args = parser.parse_args()

    df = pd.read_csv(args.leituras)
    df["timestamp_leitura"] = pd.to_datetime(df["timestamp_leitura"], utc=True, format="ISO8601")
    df["recebido_em"] = pd.to_datetime(df["recebido_em"], utc=True, format="ISO8601")
    if args.sensor:
        df = df[df["sensor_id"] == args.sensor]
    elif df["sensor_id"].nunique() > 1:
        sys.exit("o CSV tem mais de um sensor: informe --sensor")
    if args.desde:
        df = df[df["timestamp_leitura"] >= pd.Timestamp(args.desde)]
    if args.ate:
        df = df[df["timestamp_leitura"] < pd.Timestamp(args.ate)]
    if df.empty:
        sys.exit("nenhuma leitura no recorte")

    df = df.sort_values("timestamp_leitura")
    seg_banco = segmentar(df["sequencia"].tolist())

    duplicadas = None
    if args.serial:
        seg_serial, duplicadas = ler_serial(args.serial)
        if len(seg_serial) != len(seg_banco):
            sys.exit(f"o log tem {len(seg_serial)} boot(s) e o banco {len(seg_banco)}: recorte o log/--desde/--ate "
                     "para cobrir exatamente a mesma condição")
        limites = [(s[0], s[-1]) for s in seg_serial]
    else:
        print("aviso: sem --serial, N_esp vem do 1º/último RECEBIDO de cada boot (perdas no fim não aparecem)")
        limites = [(s[0], s[-1]) for s in seg_banco]

    esperadas = recebidas = 0
    perdidas = []
    for i, ((s_prim, s_ult), recebidos) in enumerate(zip(limites, seg_banco), start=1):
        n_esp = s_ult - s_prim + 1
        rec = set(seq for seq in recebidos if s_prim <= seq <= s_ult)
        faltando = sorted(set(range(s_prim, s_ult + 1)) - rec)
        print(f"boot {i}: sequências {s_prim}..{s_ult}, esperadas {n_esp}, recebidas {len(rec)}, "
              f"perdidas {len(faltando)}" + (f" {resumir(faltando)}" if faltando else ""))
        esperadas += n_esp
        recebidas += len(rec)
        perdidas += faltando

    atraso_s = (df["recebido_em"] - df["timestamp_leitura"]).dt.total_seconds()
    atrasadas = int((atraso_s > args.limiar_atraso).sum())
    te = recebidas / esperadas * 100

    linha = {
        "condicao": args.condicao,
        "esperadas": esperadas,
        "recebidas": recebidas,
        "duplicadas_rejeitadas": duplicadas if duplicadas is not None else "",
        "taxa_entrega_pct": round(te, 2),
        "perdidas": len(perdidas),
        "entregues_pela_fila": atrasadas,
        "atraso_max_s": round(atraso_s.max(), 1),
    }
    print()
    for chave, valor in linha.items():
        print(f"{chave}: {valor}")

    if args.saida:
        caminho = Path(args.saida)
        caminho.parent.mkdir(parents=True, exist_ok=True)
        pd.DataFrame([linha]).to_csv(caminho, mode="a", header=not caminho.exists(), index=False)
        print(f"\nlinha acrescentada em {caminho}")


def resumir(seqs):
    """[3,4,5,9] -> '3–5, 9' (lista de perdidas legível no terminal)."""
    faixas, inicio = [], None
    for i, s in enumerate(seqs):
        if inicio is None:
            inicio = s
        if i + 1 == len(seqs) or seqs[i + 1] != s + 1:
            faixas.append(f"{inicio}–{s}" if s != inicio else str(s))
            inicio = None
    return "(" + ", ".join(faixas) + ")"


if __name__ == "__main__":
    main()
