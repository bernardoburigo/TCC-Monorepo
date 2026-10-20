#!/usr/bin/env python3
"""Calibração e precisão volumétrica do YF-S201 (Sprint 6; artigo, Seções 2.6.2, 2.6.3, 3.2 e 3.3).

Entrada: CSV de ensaios de bancada (modelo em `modelos/ensaios.csv`), uma linha por ensaio:

    campanha      calibracao | validacao
    faixa         baixa | media | alta
    repeticao     1..n
    pulsos_antes  `pulsos_total` do Serial antes de abrir o registro
    pulsos_depois `pulsos_total` do Serial depois de fechar o registro
    volume_real_l volume aferido no recipiente graduado (L)
    tempo_s       tempo de escoamento no cronômetro (s)
    observacao    livre (opcional)

O volume lido sai dos PULSOS do ensaio (pulsos_depois − pulsos_antes), não do volume do
Serial, para o mesmo ensaio poder ser avaliado com o fator teórico e com o calibrado.

    V_lido = P / (K × 60)                            (Equação 1; K em Hz por L/min)
    K_novo = K_atual × ΣV_lido / ΣV_real             (Equação 2; só a campanha de calibração)
    e_i = (V_lido − V_real) / V_real × 100,  EPM = média |e_i|,  CV = s / média V_lido × 100
    R = (EPM_antes − EPM_depois) / EPM_antes × 100

Saída (em --saida): tabela3_calibracao.csv, tabela4_precisao.csv, tabela5_repetibilidade.csv,
figura4_erro_por_faixa.png e ensaios_calculados.csv (cada ensaio com V_lido e e_i).

Uso:
    python3 docs/scripts/analise/calibracao.py ensaios.csv --saida resultados/
"""

import argparse
import sys
from pathlib import Path

import pandas as pd

FAIXAS = ["baixa", "media", "alta"]
COLUNAS = ["campanha", "faixa", "repeticao", "pulsos_antes", "pulsos_depois", "volume_real_l", "tempo_s"]


def carregar(caminho):
    df = pd.read_csv(caminho, comment="#")
    faltando = [c for c in COLUNAS if c not in df.columns]
    if faltando:
        sys.exit(f"colunas ausentes em {caminho}: {', '.join(faltando)}")
    df["campanha"] = df["campanha"].str.strip().str.lower()
    df["faixa"] = df["faixa"].str.strip().str.lower()
    invalidas = set(df["faixa"]) - set(FAIXAS)
    if invalidas:
        sys.exit(f"faixa inválida: {', '.join(sorted(invalidas))} (use {', '.join(FAIXAS)})")
    df["pulsos"] = df["pulsos_depois"] - df["pulsos_antes"]
    if (df["pulsos"] < 0).any():
        sys.exit("pulsos_depois < pulsos_antes em algum ensaio (o ESP32 reiniciou no meio?)")
    df["vazao_l_min"] = df["volume_real_l"] / df["tempo_s"] * 60
    df["freq_hz"] = df["pulsos"] / df["tempo_s"]
    return df


def volume_lido(pulsos, k):
    return pulsos / (k * 60)


def erro_pct(v_lido, v_real):
    return (v_lido - v_real) / v_real * 100


def ordenar(tabela):
    return tabela.reindex([f for f in FAIXAS if f in tabela.index])


def main():
    parser = argparse.ArgumentParser(description="Calibração (Eq. 2) e precisão por faixa de vazão (Tabelas 3–5, Figura 4).")
    parser.add_argument("ensaios", help="CSV de ensaios (ver modelos/ensaios.csv)")
    parser.add_argument("--k-teorico", type=float, default=7.5, help="K do datasheet, Hz por L/min (padrão 7,5 = 450 pulsos/L)")
    parser.add_argument("--k-novo", type=float, default=None,
                        help="usa este K na validação em vez do calculado pela Equação 2")
    parser.add_argument("--saida", default="resultados", help="pasta de saída")
    args = parser.parse_args()

    df = carregar(args.ensaios)
    saida = Path(args.saida)
    saida.mkdir(parents=True, exist_ok=True)

    calib = df[df["campanha"] == "calibracao"].copy()
    valid = df[df["campanha"] == "validacao"].copy()
    if calib.empty and args.k_novo is None:
        sys.exit("sem ensaios de calibração: informe --k-novo")

    # --- Campanha de calibração (Tabela 3, fator teórico) e Equação 2 ---
    k_teo = args.k_teorico
    if not calib.empty:
        calib["v_lido_l"] = volume_lido(calib["pulsos"], k_teo)
        calib["erro_pct"] = erro_pct(calib["v_lido_l"], calib["volume_real_l"])
        k_eq2 = k_teo * calib["v_lido_l"].sum() / calib["volume_real_l"].sum()

        agrupado = calib.groupby("faixa")
        tabela3 = ordenar(pd.DataFrame({
            "n": agrupado.size(),
            "vazao_media_l_min": agrupado["vazao_l_min"].mean(),
            "pulsos_medios": agrupado["pulsos"].mean(),
            "freq_media_hz": agrupado["freq_hz"].mean(),
            "vol_lido_medio_l": agrupado["v_lido_l"].mean(),
            "erro_medio_pct": agrupado["erro_pct"].mean(),
        }))
        tabela3.loc["geral"] = [
            len(calib), calib["vazao_l_min"].mean(), calib["pulsos"].mean(), calib["freq_hz"].mean(),
            calib["v_lido_l"].mean(), calib["erro_pct"].mean(),
        ]
        tabela3["n"] = tabela3["n"].astype(int)
        tabela3.to_csv(saida / "tabela3_calibracao.csv", float_format="%.4f")
        print("Tabela 3 — campanha de calibração com o fator teórico (K = %.4g)" % k_teo)
        print(tabela3.round(3).to_string(), "\n")
        print(f"Equação 2: K_novo = {k_eq2:.4f} Hz/(L/min) = {k_eq2 * 60:.1f} pulsos/L "
              f"({(k_eq2 / k_teo - 1) * 100:+.2f}% em relação ao teórico)\n")
    else:
        k_eq2 = None

    k_novo = args.k_novo if args.k_novo is not None else k_eq2

    # --- Campanha de validação (Tabelas 4 e 5): mesmos pulsos com K teórico e K calibrado ---
    if valid.empty:
        print("sem ensaios de validação: Tabelas 4 e 5 e Figura 4 não geradas")
        return

    valid["v_lido_antes_l"] = volume_lido(valid["pulsos"], k_teo)
    valid["v_lido_l"] = volume_lido(valid["pulsos"], k_novo)
    valid["erro_antes_pct"] = erro_pct(valid["v_lido_antes_l"], valid["volume_real_l"])
    valid["erro_pct"] = erro_pct(valid["v_lido_l"], valid["volume_real_l"])
    valid["ea_l"] = (valid["v_lido_l"] - valid["volume_real_l"]).abs()

    agrupado = valid.groupby("faixa")
    epm_antes = agrupado["erro_antes_pct"].apply(lambda e: e.abs().mean())
    epm_depois = agrupado["erro_pct"].apply(lambda e: e.abs().mean())
    tabela4 = ordenar(pd.DataFrame({
        "n": agrupado.size(),
        "vazao_media_l_min": agrupado["vazao_l_min"].mean(),
        "ea_medio_l": agrupado["ea_l"].mean(),
        "epm_antes_pct": epm_antes,
        "epm_depois_pct": epm_depois,
        "vies_depois_pct": agrupado["erro_pct"].mean(),
        "reducao_pct": (epm_antes - epm_depois) / epm_antes * 100,
    }))
    tabela4.to_csv(saida / "tabela4_precisao.csv", float_format="%.4f")

    epm_antes_geral = valid["erro_antes_pct"].abs().mean()
    epm_depois_geral = valid["erro_pct"].abs().mean()
    print("Tabela 4 — precisão volumétrica na validação (K calibrado = %.4f)" % k_novo)
    print(tabela4.round(3).to_string())
    print(f"Geral: EPM {epm_antes_geral:.2f}% -> {epm_depois_geral:.2f}% "
          f"(redução de {(epm_antes_geral - epm_depois_geral) / epm_antes_geral * 100:.1f}%)\n")

    tabela5 = ordenar(pd.DataFrame({
        "n": agrupado.size(),
        "vol_referencia_l": agrupado["volume_real_l"].mean(),
        "media_lida_l": agrupado["v_lido_l"].mean(),
        "desvio_padrao_l": agrupado["v_lido_l"].std(ddof=1),
    }))
    tabela5["cv_pct"] = tabela5["desvio_padrao_l"] / tabela5["media_lida_l"] * 100
    tabela5.to_csv(saida / "tabela5_repetibilidade.csv", float_format="%.4f")
    print("Tabela 5 — repetibilidade (fator calibrado)")
    print(tabela5.round(4).to_string(), "\n")

    pd.concat([calib, valid], ignore_index=True).to_csv(saida / "ensaios_calculados.csv", index=False, float_format="%.6f")
    figura4(valid, saida / "figura4_erro_por_faixa.png")
    print(f"arquivos gravados em {saida}/")


def figura4(valid, caminho):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    faixas = [f for f in FAIXAS if f in set(valid["faixa"])]
    rotulos = {"baixa": "Baixa", "media": "Média", "alta": "Alta"}
    fig, ax = plt.subplots(figsize=(7, 4))
    posicoes, dados, cores = [], [], []
    for i, faixa in enumerate(faixas):
        sub = valid[valid["faixa"] == faixa]
        dados += [sub["erro_antes_pct"], sub["erro_pct"]]
        posicoes += [i * 3 + 1, i * 3 + 2]
        cores += ["#bbbbbb", "#3b82c4"]
    caixas = ax.boxplot(dados, positions=posicoes, widths=0.7, patch_artist=True, medianprops={"color": "black"})
    for caixa, cor in zip(caixas["boxes"], cores):
        caixa.set_facecolor(cor)
    ax.axhline(0, color="black", linewidth=0.8)
    ax.set_xticks([i * 3 + 1.5 for i in range(len(faixas))])
    ax.set_xticklabels([rotulos[f] for f in faixas])
    ax.set_xlabel("Faixa de vazão")
    ax.set_ylabel("Erro percentual e_i (%)")
    ax.legend([caixas["boxes"][0], caixas["boxes"][1]], ["Fator teórico", "Fator calibrado"], loc="best")
    fig.tight_layout()
    fig.savefig(caminho, dpi=200)


if __name__ == "__main__":
    main()
