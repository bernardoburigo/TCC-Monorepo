#!/usr/bin/env python3
"""Latência de atualização por etapa (Sprint 6; artigo, Seção 2.6.3, Equação 5, Tabela 7).

    L_ing = t_pers − t_cap,   L_exib = t_exib − t_pers,   L_tot = t_exib − t_cap

Entrada: o CSV exportado pela tela do sensor do app com EXPO_PUBLIC_REGISTRAR_LATENCIA=true
(colunas sensor_id, sequencia, timestamp_leitura, recebido_em, exibido_em — ver app/README.md):
t_cap = timestamp_leitura (fim da janela de 5 s, relógio do ESP32/NTP), t_pers = recebido_em
(relógio do servidor) e t_exib = exibido_em (relógio do dispositivo que exibiu).

Saída: média, mediana, P95, máximo e desvio padrão (amostral) de cada etapa, em segundos.
Valores negativos indicam relógios dessincronizados e são reportados (não descartados).

Uso:
    python3 docs/scripts/analise/latencia.py latencia-*.csv --saida resultados/tabela7_latencia.csv
"""

import argparse
import sys
from pathlib import Path

import pandas as pd


def main():
    parser = argparse.ArgumentParser(description="Latência por etapa (Equação 5, Tabela 7).")
    parser.add_argument("arquivos", nargs="+", help="CSV(s) exportados pelo app (vários são concatenados)")
    parser.add_argument("--sensor", help="filtra um sensor_id")
    parser.add_argument("--saida", help="CSV da Tabela 7")
    args = parser.parse_args()

    df = pd.concat([pd.read_csv(a) for a in args.arquivos], ignore_index=True)
    if args.sensor:
        df = df[df["sensor_id"] == args.sensor]
    # mesma leitura exportada em dois arquivos conta uma vez (fica o 1º registro de exibição)
    df = df.drop_duplicates(subset=["sensor_id", "sequencia", "timestamp_leitura"], keep="first")
    if df.empty:
        sys.exit("nenhuma leitura")

    t_cap = pd.to_datetime(df["timestamp_leitura"], utc=True, format="ISO8601")
    t_pers = pd.to_datetime(df["recebido_em"], utc=True, format="ISO8601")
    t_exib = pd.to_datetime(df["exibido_em"], utc=True, format="ISO8601")
    etapas = {
        "Ingestão (L_ing)": (t_pers - t_cap).dt.total_seconds(),
        "Exibição (L_exib)": (t_exib - t_pers).dt.total_seconds(),
        "Total (L_tot)": (t_exib - t_cap).dt.total_seconds(),
    }

    tabela = pd.DataFrame({
        nome: {
            "n": len(valores),
            "media_s": valores.mean(),
            "mediana_s": valores.median(),
            "p95_s": valores.quantile(0.95),
            "max_s": valores.max(),
            "dp_s": valores.std(ddof=1),
            "negativos": int((valores < 0).sum()),
        }
        for nome, valores in etapas.items()
    }).T
    tabela["n"] = tabela["n"].astype(int)
    tabela["negativos"] = tabela["negativos"].astype(int)

    print(f"Tabela 7 — latência de atualização por etapa ({len(df)} leituras)")
    print(tabela.round(3).to_string())
    if tabela["negativos"].any():
        print("\naviso: há latências negativas — conferir a sincronização NTP do ESP32, do servidor e do dispositivo")

    if args.saida:
        caminho = Path(args.saida)
        caminho.parent.mkdir(parents=True, exist_ok=True)
        tabela.to_csv(caminho, float_format="%.4f", index_label="etapa")
        print(f"\ngravado em {caminho}")


if __name__ == "__main__":
    main()
