# Avanço do sistema — 19/10/2026

> Registro de desenvolvimento do dia. Ver seção "Convenções para o Claude
> Code" do `CLAUDE.md` para o propósito destes arquivos `stack-DD-MM.md`.
> Continua de `docs/stack-16-10.md`.

## Resumo do dia

Validação de paridade entre o artigo final (versão de 19/10) e o
repositório. Além de trechos desatualizados, a análise achou **duas partes
do método da Sprint 6 que o artigo descrevia mas o repositório não tinha**:
o registro do instante de exibição (t_exib) e os scripts de análise em
Python/pandas. As duas foram implementadas e verificadas hoje, junto com
dois ajustes no Serial do firmware para a bancada. As correções de texto do
artigo ficaram em `docs/paridade-artigo-19-10.md`, com redação sugerida.

## 1. Paridade artigo × repositório

Relatório completo: `docs/paridade-artigo-19-10.md`. Principais achados:

- **Retransmissão (crítico):** o artigo diz em três lugares (§2.2, §3.4, §4)
  que o firmware não retransmite leituras e lista isso como trabalho futuro,
  mas a fila em RAM com reenvio existe desde a Sprint 3 e já foi observada no
  hardware em 15/10. Isso muda também a leitura da taxa de entrega: com a
  fila, quedas curtas tendem a TE ≈ 100%, e o efeito aparece como entregas
  atrasadas.
- **t_exib e scripts de análise** descritos no método (§2.5, §2.6.3), mas
  ausentes do repositório → implementados (seções 2 e 3).
- Tabela 1 com `registrar` como público (fechado por `X-Admin-Token` em
  16/10); constante de calibração "em arquivo" (está na NVS); "quatro testes"
  e "20,7% de flash" (são 23 testes e 80,4%).
- Placeholders que já podem ser preenchidos: 30 min de fluxo contínuo,
  servidor doméstico, polling de 5 s/10 s, um conjunto, Python.
- A banca pode perguntar sobre o YF-S201 alimentado em 3,3 V (abaixo da
  tensão nominal) — decidir antes da calibração se continua assim (e
  declarar) ou se passa para 5 V.
- As 4 pendências da validação de 09/10 já estavam corrigidas no PDF.

O PDF atualizado estava na raiz do repositório; voltou para
`docs/TCC_Bernardo_Goulart_Búrigo.pdf`, onde o `CLAUDE.md` e o
`progresso.md` o referenciam.

## 2. Registro de t_exib no app

O artigo (Equação 5) decompõe a latência em L_ing, L_exib e L_tot, mas o app
só mostrava `recebidoEm − timestampLeitura` da última leitura.

- `app/src/lib/latencia.ts` (puro): guarda os ids já vistos por sensor e
  registra `exibidoEm` só para leituras que **apareceram durante o
  acompanhamento** — a primeira carga da tela traz 10 min de histórico de uma
  vez, e o t_exib dessas não mede nada. A mesma leitura em vários pollings
  entra uma vez. `paraCsv` gera o CSV lido pelo script de latência.
- `app/src/hooks/useRegistroLatencia.ts`: buffer por execução do app,
  alimentado por um `useEffect` na tela do sensor (roda depois da renderização
  que já mostra a leitura); exportação por download na Web.
- Desligado por padrão: `EXPO_PUBLIC_REGISTRAR_LATENCIA=true` mostra na tela
  do sensor a contagem de exibições registradas e o botão "Exportar latência
  (CSV)". Documentado em `app/README.md` e `app/.env.example`.
- Sem mudança no backend: `GET /api/sensores/{id}/leituras` já devolve `id`,
  `sequencia` e `recebidoEm`.

**Armadilha:** o modo mock não serve para verificar isso — o
`gerarLeituras` monta os ids pelo índice da janela, então todo polling
devolve os mesmos ids. A verificação foi feita contra o backend local com o
simulador.

**Verificação:** `npm run typecheck` ok; Jest **46/46** (5 novos). No
navegador headless (Playwright), com backend local + simulador: 0 registros
na primeira carga, 6 leituras novas em 32 s, CSV exportado com
`exibido_em ≥ recebido_em ≥ timestamp_leitura` em todas as linhas.
L_exib medido ≈ 3,2 s (dados SIMULADOS — só valida a ferramenta, não é
resultado).

## 3. Firmware: Serial para a bancada

- `pulsos_total` (acumulado desde o boot) na linha de amostragem: o volume
  lido de cada ensaio sai da diferença antes/depois, independente do K
  gravado na NVS — é o que o §2.6.1 do artigo descreve. Antes só havia pulsos
  por segundo e o `volume_total` já convertido pelo K.
- `[FILA] seq=N enfileirada` a cada leitura emitida: dá o N_esp da Equação 4
  mesmo quando as últimas leituras não chegam ao servidor (antes a `seq` só
  aparecia no POST).

**Verificação:** `pio test -e native` 23/23; `pio run -e esp32dev` ok, Flash
**80,4%** (1.053.573 B), RAM 16,6%. **Não gravado no ESP32 ainda** — o
hardware segue com o firmware de 16/10.

## 4. Scripts de análise (`docs/scripts/analise/`)

| Script | Equações | Saída |
|---|---|---|
| `calibracao.py` | 1, 2, 3 e R | Tabelas 3, 4, 5 e Figura 4 (boxplot do erro por faixa, antes × depois) |
| `entrega.py` | 4, por ciclo de boot | linha da Tabela 6 + entregas pela fila e atraso máximo |
| `latencia.py` | 5 | Tabela 7 (média, mediana, P95, máx., DP; conta negativos = relógios dessincronizados) |

Decisões:

- O volume lido vem dos **pulsos** do ensaio, para os mesmos ensaios da
  validação serem avaliados com o K teórico e com o calibrado (como o §2.6.2
  pede).
- `entrega.py` separa a `sequencia` por boot (ela zera quando o ESP32
  reinicia) e exige que o log do Serial e o recorte do banco tenham o mesmo
  número de boots. Sem o log, avisa que perdas no fim não aparecem.
- Cabeçalhos em `modelos/`, consulta de exportação do banco e passo a passo no
  `README.md` da pasta; dependências em `requirements.txt` (pandas e
  matplotlib não estão instalados no Python do sistema — usar um venv).

**Verificação:** com dados sintéticos gerados fora do repositório
(sensor de 494 pulsos/L), o `calibracao.py` devolveu K = 8,2333 (= 988 pulsos
médios / 2 L / 60, conferido à mão) e +9,78% de erro com o K teórico; o
`entrega.py` devolveu 145/150 = 96,67% com 5 perdidas, 1 duplicata e 8
entregas pela fila, como montado; o `latencia.py` devolveu as médias e o P95
esperados. O CSV real exportado pelo app (seção 2) também passou pelo
`latencia.py`.

## 5. Estado do repositório ao final

- Novos: `app/src/lib/latencia.ts` (+ teste), `app/src/hooks/useRegistroLatencia.ts`,
  `docs/scripts/analise/`, `docs/paridade-artigo-19-10.md`, este arquivo.
- Alterados: tela do sensor, `app/src/lib/config.ts`, `app/.env.example`,
  `app/README.md`, `firmware/src/main.cpp`, `firmware/README.md`,
  `docs/progresso.md`, `docs/README.md`, `CLAUDE.md`, PDF do artigo (versão de 19/10).
- Próximos passos: decidir a tensão do sensor; gravar o firmware novo; aplicar
  as correções de texto no LaTeX; iniciar a bancada.
