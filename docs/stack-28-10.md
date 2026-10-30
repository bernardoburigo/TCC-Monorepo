# Avanço do sistema — 23/10 e 28/10/2026

> Registro de desenvolvimento. Ver seção "Convenções para o Claude Code" do
> `CLAUDE.md` para o propósito destes arquivos `stack-DD-MM.md`.
> Continua de `docs/stack-21-10.md`. Em 23/10 houve só a primeira montagem da
> Figura 2 (seção 1); o registro foi incorporado aqui em vez de ficar num
> `stack-23-10.md` próprio.

## 1. 23/10 — primeira versão da Figura 2

Capturas do celular (APK/Expo Go apontando para a produção) formatadas em
`docs/figuras/` — recorte das áreas vazias, largura comum de 720 px e borda
cinza clara (o fundo do app é quase branco): painel do síndico, consumo de 24 h
do apto 201, painel do proprietário, vazão ao vivo do sensor real (alternativa)
e a composição `figura2-composta.png`, (a)(b)(c) alinhadas pelo topo.

Problemas apontados para a versão final (o formato servia; o conteúdo não):

- (a) com os três aptos simulados **Offline, "há 1 h"** — o `simulador.py
  rodar` não estava rodando. Lia-se como falha.
- (a) e (c) tiradas em momentos diferentes: o 201 aparecia **Online com 7,3 L**
  em (a) e **Offline com 4,7 L, "há 7 h"** em (c).
- (b): o pico de 34,9 L às 21h de 20/10 veio de pulsos sem água (sopro/rotor),
  com o K teórico — não é consumo real.
- A legenda do artigo prevê (a) **web** do síndico; as três são do celular.

Os dois primeiros foram resolvidos em 28/10 (seção 5); o terceiro mudou de
natureza e o quarto continua pendente (seção 7).

## 2. 28/10 — preparação da bancada

Primeira sessão com água (Sprint 6, Etapa 2 do roteiro). ESP32 no notebook
(`/dev/ttyACM0`), firmware de 19/10, K teórico (450 pulsos/L), enviando para
`https://apitcc.bernardoburigo.com.br`. Relógio do notebook sincronizado por NTP
(`timedatectl`).

- Venv de análise criada (`docs/scripts/analise/.venv`, já no `.gitignore`).
- Serial gravado por `serial_log.py` em `docs/resultados/serial-calibracao-28-10.log`
  (17:53–18:55, um boot só; abrir a porta reiniciou o ESP32, como esperado).
- Um monitor sobre o log avisava início/fim de fluxo com o `pulsos_total`
  antes/depois e os POSTs anormais — ninguém precisou ler o Serial na bancada.
- Planilha `docs/resultados/ensaios.csv` criada a partir do modelo.

## 3. 28/10 — ensaios exploratórios de volume (despejo por gravidade)

Montagem: copo → funil (passador de café, furo único) → cano de PVC → YF-S201
**na vertical, água descendo** → cano de PVC → recipiente. Referência por
**massa**: balança de cozinha SF-400 (resolução 1 g, até 10 kg), recipiente
coletor com tara de 103 g (1 g de água ≈ 1 mL; correção por densidade < 0,3%).
Linhas `exploratorio` no `ensaios.csv` (o `calibracao.py` as ignora).

| # | Método | Pulsos | Massa coletada | Erro (K teórico) | Fator implícito | Vazão média |
|---|---|---|---|---|---|---|
| 1 | copo → funil fino | 316 | 508 g | +38,2% | 622 pulsos/L | 0,92 L/min |
| 2 | idem, canos já molhados | 318 | 508 g | +39,1% | 626 pulsos/L | 1,22 L/min |
| 3 | copo direto no cano | 236 | 507 g | +3,4% | 466 pulsos/L | 0,80 L/min |

- 1 e 2 repetem muito bem (2 pulsos de diferença) — descarta a hipótese de água
  retida no cano seco no 1º ensaio.
- 3 mudou o fator em ~35% só trocando a forma de despejar, com vazão parecida:
  o erro depende da **hidráulica do despejo**, não da vazão. Com o sensor na
  vertical e a água descendo, ele nunca enche — no funil, jatos em queda livre
  com ar giram o rotor mais que o volume justifica; direto do copo, a água
  escorre pela parede. O 3 bater com o datasheet é coincidência.
- Pelas fotos da balança, no ensaio 1 o copo foi de 49 g (vazio) para 561 g
  (cheio): 512 g despejados × 508 g coletados — ~4 g (0,8%) ficaram no caminho.
- Todas as vazões ficaram em ~1 L/min, no limite inferior do YF-S201 (1–30 L/min):
  o passador de café limita a vazão.
- Firmware conferido: interrupção só na borda de descida (`FALLING`), sem
  contagem dupla; com o sensor parado, `pulsos=0` (sem ruído elétrico).

**Decisão:** o despejo livre em sensor vertical **não serve para calibrar** — o
fator depende do jeito de despejar e não representa o sensor afogado de uma
instalação real. Alternativas avaliadas e descartadas: funil maior (não resolve
o sensor vazio); garrafa PET fechada colada na saída (o ar sairia subindo pelo
sensor, contra a água, e o sensor só enche no fim); copo de transbordo envolvendo
o sensor (funciona, mas molha o conector/fios).

**Nova montagem (a fazer):** mangueira cristal (~1 m) na saída, subindo acima do
topo do sensor antes de descer para o recipiente, para o sensor ficar sempre
cheio (pode continuar vertical); garrafa PET sem fundo como funil (cabe os
500 mL). A água parada no "U" é constante entre ensaios (vasos comunicantes):
cada despejo empurra para fora o volume que entrou. Procedimento: escorvar uma
vez e bater no sensor para soltar bolhas; critério de fim = 10 s sem pingar
(também na escorva); tarar o recipiente depois disso; não mexer na montagem
entre ensaios (mexeu, escorva de novo). Faixas de vazão por tampas da
garrafa-funil (furo pequeno / maior / sem tampa). O fim de cada despejo passa
por vazão baixa onde o sensor pode perder pulsos — sistemático, absorvido pela
calibração, citar como limitação. Os três ensaios de hoje viram achado do texto
(montagem vertical descendente gerou erro de ~38%).

## 4. 28/10 — rede estável (Tabela 6) e latência (Tabela 7)

Aproveitando a mesma sessão (rede da casa, sem download pesado):

- **Entrega** (`exportar_leituras.py` + `entrega.py`): 676 esperadas, 676
  recebidas, **TE = 100%**, 11 entregues pela fila (atraso > 10 s), atraso
  máximo 32,1 s, 1 duplicada rejeitada (409). Linha em `tabela6_entrega.csv`.
- Falhas de envio: 5 em ~1 h (`SSL - The connection indicated an EOF`, `-1`, e
  `-11` = timeout de leitura), todas com `wifi=ok` — vêm do túnel/servidor, não
  do Wi-Fi. A fila reenviou todas (backoff 5 s → 10 s). O `seq=150` teve timeout
  depois de o servidor já ter persistido a leitura — o reenvio recebeu 409,
  contado como sucesso, como previsto.
- **Cada POST lento trava o loop do firmware** (até ~19 s): a contagem de pulsos
  não perde nada (interrupção, o total bateu), mas a janela daquela leitura fica
  maior que 5 s e esconde o fim exato do fluxo no Serial. Limitação: afeta a
  resolução temporal, não o volume.
- **Latência** (`latencia.py`, CSV do app da Vercel): a tela ficou em segundo
  plano das 17:58 às 18:34 e, ao voltar, o polling exibiu 326 leituras no mesmo
  segundo — "latências" de até 30 min que não são do sistema; as leituras de
  ~17:58 a 18:04 nem chegaram a ser registradas. Nova opção `--descartar-lotes
  N` no `latencia.py` (descarta leituras exibidas num mesmo segundo com mais de N
  e informa quantas). Com `--descartar-lotes 3`, 344 leituras (~32 min de tela
  visível: 17:47–17:58 e 18:34–18:55):

  | Etapa | Média | Mediana | P95 | Máx. |
  |---|---|---|---|---|
  | L_ing | 1,64 s | 1,19 s | 3,21 s | 26,7 s |
  | L_exib | 2,83 s | 2,69 s | 5,56 s | 7,34 s |
  | L_tot | 4,48 s | 4,14 s | 7,93 s | 27,8 s |

  O máximo vem das leituras que passaram pela fila. Média e P95 abaixo dos 10 s
  sugeridos como critério de L_tot.

## 5. 28/10 — simulador em produção e figuras

- No servidor (tmux): `historico --horas 24` + `rodar --perfil 103=vazamento
  --log docs/resultados/simulador-alerta-28-10.log --vigiar-alertas`. Aptos
  101–103 Online (prints da Figura 2). O teste de alerta **não foi medido**: o
  `simulador-alerta-28-10.log` do servidor só tem uma execução das 19:20:22 que
  parou 5 s depois, logo após registrar o T0 do 103 (limite previsto para
  19:50:27) — nenhuma execução chegou aos 30 min com o log ligado.
- Novo `docs/scripts/figuras.py` monta as figuras a partir de `docs/figuras/`
  (mesmo estilo de 23/10, mais as letras (a)(b)(c)):
  - `figura2-composta.png` — (a) síndico com 4 aptos Online, (b) consumo de 24 h
    do apto 201, (c) proprietário. (a) e (c) no mesmo estado (1,9 L, Online):
    resolve os dois primeiros problemas de 23/10. **(b) provisório:** bug do
    eixo Y (seção 6) e consumo dos despejos de hoje, com o K teórico e o método
    descartado (1,9 L exibidos para ~1,52 L reais). A composição de 23/10 foi
    substituída.
  - `figura3-bancada.png` — provisória: (a) protótipo (foto de 24/10), (b)
    referência por massa (balança).
- Capturas da tela do sensor (vazão ao vivo + "Atraso medida → servidor 1,1 s")
  ficaram como alternativa para o (b).

## 6. Bugs reais encontrados (28/10)

- **Eixo Y do gráfico de consumo** mostrava "2 L, 1 L, 1 L, 0 L, 0 L". O
  `react-native-gifted-charts` só mantém decimais quando a faixa dos dados é ≤ 1;
  acima disso corta o rótulo no ponto **antes** do `formatYLabel` (0,5 → "0").
  Correção: `showFractionalValues` + `roundToDigits={casasDoPasso(passo)}` no
  `ConsumoChart` e no `VazaoChart` (nova `casasDoPasso` em `app/src/lib/eixo.ts`,
  com teste). Jest 47/47 e `tsc` ok; **ainda não conferido na tela**.
- **`exportar_leituras.py` → 403 "error code: 1010"** pelo Cloudflare: a
  verificação de integridade barra o User-Agent `Python-urllib`. Agora envia
  `User-Agent: tcc-analise/1.0` (conferido com curl: 403 → 401 com usuário
  inexistente). O `simulador.py` não é afetado (usa `127.0.0.1` no servidor).
- **Comandos do simulador passados errados:** `--api` só existe no
  `provisionar`; `historico`/`rodar` usam a URL do arquivo de estado. E as linhas
  `export ...` e `E=...` coladas juntas fizeram a senha absorver o resto da
  linha — usar `read -rs TCC_SINDICO_SENHA` (também tira a senha do histórico).

## 7. Testes e pendências

Feito em 28/10:

- [x] 3 ensaios exploratórios de volume (método de despejo descartado; pesagem aprovada)
- [x] Rede estável, 62 min: TE = 100%
- [x] Latência: L_tot média 4,5 s, P95 7,9 s (~32 min úteis)
- [x] Simulador em produção com os aptos virtuais Online (teste de alerta ficou pendente)
- [x] Figura 2 (a) e (c) finais; Figuras 2 e 3 montadas por script

Pendente, em ordem:

1. **Bancada com mangueira** (comprar ~1 m de mangueira cristal) → escorva →
   3 despejos iguais para checar a estabilidade → definir as 3 faixas pelas
   tampas e medir a vazão de cada uma (Tabela 2).
2. **Calibração** 10/faixa → `calibracao.py` → K em pulsos/L no portal (BOOT 3 s;
   ter a senha do Wi-Fi; **anotar data/hora da troca**) → **validação** 30/faixa.
3. **Quedas de rede:** 3 × 120 s (roteador desligado, intervalo ≥ 5 min), num
   log próprio, anotando os horários → `entrega.py`.
4. **Latência com a tela sempre visível** (opcional, para ter 60 min úteis)
   — sem dormir a tela nem trocar de aba.
5. **Teste de alerta (refazer):** no servidor, em tmux, `rodar --perfil
   103=vazamento --log docs/resultados/simulador-alerta-DD-MM.log
   --vigiar-alertas` por **≥ 35 min sem interromper** (com a senha do síndico em
   `TCC_SINDICO_SENHA`); o log registra T0, limite e o instante em que o alerta
   aparece na API — o "X s após o limite" do §3.1. Esperar ≥ 15 s depois de
   parar uma execução anterior (senão o fluxo emenda e o T0 fica tardio). Dá
   para rodar junto com a sessão de calibração.
6. **App:** deploy na Vercel (e APK novo, se a figura vier do celular) com o eixo
   corrigido; conferir na tela.
7. **Figura 2 (b):** novo print do consumo do 201 depois da calibração, com água
   pela montagem nova; rodar `figuras.py`.
8. **Figura 3:** foto da bancada com mangueira; atualizar a lista `FIGURA3`.
9. **Arquivos de origem das figuras:** as capturas e fotos saíram de
   `docs/figuras/` às 18:53 (estão em `~/Downloads`); voltar com elas para a
   pasta antes de rodar o `figuras.py`. `figura2b-consumo-apto201.png` e
   `figura2-sensor-ao-vivo-201.png` (versionadas em 20/10) aparecem como
   removidas — `git restore` se forem mantidas.
10. **Overleaf:** reescrever o §2.6.1 (despejo por gravidade + sifão + referência
    por massa, faixas por tampas) e a legenda da Figura 3; legenda da Figura 2
    (três telas do celular); critério de aceitação de L_tot no §2.6.3, se ainda
    não fixado; limitações novas (POST lento alonga a janela; vazão baixa no fim
    de cada despejo).
11. **Commit** de tudo (nada commitado ainda).

## 8. Estado do repositório ao final

- Novos: `docs/stack-28-10.md` (absorve o `stack-23-10.md`, removido),
  `docs/scripts/figuras.py`, `docs/figuras/figura2-composta.png`,
  `docs/figuras/figura3-bancada.png`, `docs/resultados/` (`ensaios.csv`,
  `serial-calibracao-28-10.log`, `latencia-2026-10-28T21-55-20-449Z.csv`,
  `leituras-estavel-28-10.csv`, `tabela6_entrega.csv`, `tabela7_latencia.csv`).
- Alterados: `app/src/lib/eixo.ts` (+ teste), `app/src/components/ConsumoChart.tsx`,
  `VazaoChart.tsx`, `docs/scripts/analise/latencia.py`,
  `docs/scripts/analise/exportar_leituras.py`, `docs/progresso.md`.
- Nada commitado.
