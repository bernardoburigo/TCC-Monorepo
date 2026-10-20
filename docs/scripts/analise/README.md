# Análise dos testes de bancada (Sprint 6)

Scripts que transformam os dados brutos da bancada nas Tabelas 3–7 e na
Figura 4 do artigo (Seção 2.6.3). Todos recebem CSV e gravam CSV/PNG em
`--saida`; nenhum fala com a API ou com o banco.

| Script | Métrica (artigo) | Entrada | Saída |
|---|---|---|---|
| `calibracao.py` | K (Eq. 2), EA, e_i, EPM, viés, R, CV (Eq. 3) | `ensaios.csv` (planilha da bancada) | Tabelas 3, 4, 5 e Figura 4 |
| `entrega.py` | TE (Eq. 4) + entregas pela fila | `leituras.csv` (banco) + log do Serial | uma linha da Tabela 6 por condição |
| `latencia.py` | L_ing, L_exib, L_tot (Eq. 5) | CSV exportado pelo app | Tabela 7 |

Os cabeçalhos esperados estão em `modelos/`. Os dados reais e os resultados
podem ir para `docs/resultados/` (versionados, insumo do artigo);
`resultados/` dentro desta pasta é ignorado pelo git (rascunhos).

## Ambiente

```bash
python3 -m venv docs/scripts/analise/.venv
docs/scripts/analise/.venv/bin/pip install -r docs/scripts/analise/requirements.txt
alias py=docs/scripts/analise/.venv/bin/python
```

## 1. Calibração e precisão — `calibracao.py`

Na bancada, para cada ensaio anote no `ensaios.csv` o `pulsos_total` do
Serial **antes de abrir** e **depois de fechar** o registro, o volume aferido
no recipiente e o tempo no cronômetro. O volume lido é calculado dos pulsos
(não do `volume_total` do Serial), então os mesmos ensaios servem para o
fator teórico e para o calibrado.

```bash
py docs/scripts/analise/calibracao.py docs/resultados/ensaios.csv --saida docs/resultados/
```

A campanha `calibracao` produz o K da Equação 2 (impresso também em
pulsos/L — é esse valor que vai no portal cativo, campo *Pulsos por litro*).
A `validacao` é avaliada com o K teórico e com o calibrado. `--k-novo`
força um K na validação (ex.: o que foi de fato gravado no ESP32).

## 2. Taxa de entrega — `entrega.py`

Durante cada condição (rede estável por T minutos; roteador desligado X s em
N ocasiões), grave o Serial em arquivo:

```bash
cd firmware && pio device monitor | tee ../docs/resultados/serial-estavel.log
```

Depois exporte as leituras persistidas do mesmo intervalo (no servidor):

```bash
docker exec tcc-db psql -U tcc -d tcc_telemetria -c "\copy (
  SELECT sensor_id, sequencia, timestamp_leitura, recebido_em FROM leitura
  WHERE sensor_id = '<uuid-do-sensor>'
    AND timestamp_leitura >= '2026-10-28T13:00:00Z' AND timestamp_leitura < '2026-10-28T14:00:00Z'
  ORDER BY timestamp_leitura) TO STDOUT WITH CSV HEADER" > docs/resultados/leituras-estavel.csv
```

```bash
py docs/scripts/analise/entrega.py docs/resultados/leituras-estavel.csv \
   --serial docs/resultados/serial-estavel.log \
   --condicao "Rede estável" --saida docs/resultados/tabela6_entrega.csv
```

- N_esp vem das linhas `[FILA] seq=N enfileirada` do log (inclui o que se
  perdeu no fim); N_rec, das linhas do banco (409 nunca é persistido).
- A `sequencia` zera a cada reboot do ESP32: o script separa por boot, e o
  log e o recorte do banco precisam cobrir os mesmos boots.
- Com a fila de reenvio do firmware (200 leituras, ~16 min), quedas curtas
  tendem a TE ≈ 100%: o efeito aparece em `entregues_pela_fila` (atraso acima
  de `--limiar-atraso`, padrão 10 s) e em `atraso_max_s`. Perda só ocorre se
  a fila estourar ou o ESP32 reiniciar com leituras pendentes.

## 3. Latência — `latencia.py`

Rode o app Web com `EXPO_PUBLIC_REGISTRAR_LATENCIA=true` (ver `app/README.md`,
"Medir a latência de exibição"), deixe a tela do sensor aberta e visível
durante a coleta e use "Exportar latência (CSV)".

```bash
py docs/scripts/analise/latencia.py docs/resultados/latencia-*.csv --saida docs/resultados/tabela7_latencia.csv
```

Os três relógios (ESP32, servidor, dispositivo do app) precisam estar
sincronizados por NTP; latências negativas são contadas na coluna
`negativos` como sinal de dessincronização.

## Dia de ensaio (roteiro)

Tudo com o sensor real alimentado em 3,3 V (decisão de 20/10, §2.2 do
artigo) e o firmware de 19/10 ou mais novo (o Serial precisa mostrar
`pulsos_total`).

**Antes de começar**
1. Serial gravado em arquivo durante toda a sessão:
   `cd firmware && pio device monitor | tee ../docs/resultados/serial-DD-MM.log`.
2. Conferir no Serial `wifi=ok hora=ok` e POSTs com `-> 201`.
3. Purgar a tubulação (deixar correr até sair o ar) e marcar no registro as
   aberturas de cada faixa. Medir uma vez a vazão de cada marca e ajustar as
   faixas/V da Tabela 2 se preciso.

**Cada ensaio (uma linha no `ensaios.csv`)**
1. Sem fluxo, anotar `pulsos_antes` (o `pulsos_total` da linha mais recente).
2. Abrir o registro na marca da faixa e disparar o cronômetro juntos.
3. Fechar ao atingir o volume V no recipiente e parar o cronômetro.
4. Esperar 2 s (o último pulso entra na amostra seguinte), anotar
   `pulsos_depois`, ler o volume real no recipiente e o tempo.
5. Ensaio com falha evidente (vazou, cronômetro errado): refazer e manter a
   linha original comentada com `#` e o motivo — o script ignora, e o
   registro do refazimento fica documentado.

**Ordem**
1. Calibração: 10 ensaios por faixa, baixa → média → alta.
2. `calibracao.py` → anotar o K em **pulsos/L**.
3. Gravar o K no portal (BOOT 3 s → rede `TCC-Sensor-Setup`, campo *Pulsos
   por litro*). O BOOT apaga o Wi-Fi salvo: ter a senha em mãos. O reinício
   zera `pulsos_total` e `sequencia`, o que não afeta nada. **Anotar data e
   hora da troca** (o consumo no app muda de escala a partir dali).
4. Validação: 30 ensaios por faixa → `calibracao.py` de novo (Tabelas 3–5,
   Figura 4).
5. Comunicação + latência na mesma sessão: 60 min de rede estável com o app
   (Vercel, `EXPO_PUBLIC_REGISTRAR_LATENCIA=true`) aberto e visível na tela
   do sensor; exportar o CSV de latência ao final. Depois, 3 quedas de 120 s
   (desligar o roteador), espaçadas de pelo menos 5 min, anotando os horários.
   Exportar as leituras do banco de cada condição e rodar `entrega.py`.
