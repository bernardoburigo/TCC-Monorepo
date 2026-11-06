# Avanço do sistema — 06/11/2026

> Registro de desenvolvimento do dia. Ver seção "Convenções para o Claude
> Code" do `CLAUDE.md` para o propósito destes arquivos `stack-DD-MM.md`.
> Continua de `docs/stack-28-10.md`.

Sessão de bancada da Sprint 6 (Etapa 2 do roteiro), a três dias da entrega.
Rascunhos para o Overleaf em `docs/texto-artigo-06-11.md`.

## 1. Decisão: bancada por gravidade, sem sensor afogado

Não houve tempo de montar a saída com mangueira (sensor sempre cheio, ver
`stack-28-10.md` §3). A bancada de 28/10 passou a ser a oficial: copo → funil →
PVC → YF-S201 **vertical, água descendo** → PVC → recipiente pesado na balança
(SF-400, resolução 1 g). No texto: o escoamento por gravidade com o sensor
parcialmente preenchido é diferente do conduto forçado (cano cheio e sob pressão)
de uma instalação predial; o fator K depende dessa condição e vale para a
bancada — no condomínio a calibração seria repetida no local.

Decisões do dia (com o usuário): faixas definidas pelo **nível de água no funil**
(mesmo método em tudo), **5 de calibração + 10 de validação por faixa** (45
ensaios, em vez dos 120 do delineamento original), bancada no mesmo dia.

## 2. Troca de funil invalida os ensaios de 28/10

O passador de café de 28/10 foi trocado por um mais alto (mesma saída, cabe os
500 mL). O fator implícito caiu de ~624 (28/10, funil antigo quase transbordando)
para ~380 pulsos/L. Os dois ensaios de 28/10 voltaram a `exploratorio` com a nota
"funil antigo": o jato do funil cheio até a borda gira o rotor mais que o volume
justifica. Isso foi confirmado no alta 4 da calibração (despejo "com mais força":
516 pulsos/L), refeito.

## 3. Calibração (K = 450 no firmware)

Log `docs/resultados/serial-calibracao-06-11.log` (10:27–11:45). Massa coletada
caiu de 496 para 485 g ao longo da manhã (≈ 500 g despejados; usa-se sempre a
massa medida).

| Faixa | n | Vazão média | Fator por ensaio (pulsos/L) | Erro médio (K teórico) |
|---|---|---|---|---|
| Baixa (funil quase vazio) | 5 | 1,13 L/min | 383, 438, 389, 377, 400 | −11,8% |
| Média (funil mais cheio) | 5 | 1,18 L/min | 371, 375, 362, 373, 386 | −17,0% |
| Alta (500 mL de uma vez) | 5 | 2,09 L/min | 382, 376, 381, 442, 377 | −12,9% |

**Equação 2: K = 6,4564 Hz/(L/min) = 387,4 pulsos/L** (−13,9% em relação aos 450
do datasheet). Gravado pelo portal às **11:49** (hora de Criciúma); o consumo no
app muda de escala a partir daí.

## 4. Validação (K = 387,4) — Tabelas 4 e 5, Figura 4

Log `docs/resultados/serial-validacao-06-11.log` (11:50–15:14).

| Faixa | n | Vazão | EPM (K teórico) | EPM (K calibrado) | Viés | Desvio padrão | CV |
|---|---|---|---|---|---|---|---|
| Baixa | 10 | 1,11 L/min | 8,56% | 8,57% | +6,2% | 36 mL | 7,1% |
| Média | 10 | 1,36 L/min | 12,99% | 8,68% | +1,8% | 50 mL | 10,3% |
| Alta | 10 | 2,17 L/min | 11,76% | 12,49% | +7,6% | 66 mL | 13,1% |
| Geral | 30 | | 11,10% | 9,91% | | | |

**Leitura:** a calibração corrigiu o viés sistemático (−14% → ~+5%), mas o erro
restante é **dispersão entre despejos** (CV 7–13%), que a calibração não reduz.
Redução do EPM geral de 10,7%; clara só na faixa média. Na tarde, o sensor leu
~+5% acima da calibração da manhã — provável mudança gradual no gesto do despejo.
Dispersão cresce com a vazão: com 500 mL de uma vez, pequenas diferenças no
despejo mudam muito o jato no rotor.

## 5. Comunicação (Tabela 6) e alerta (§3.1)

- **Falhas induzidas:** 3 quedas de 120 s (roteador desligado) às 12:25:38,
  13:57:18 e 14:55:58; o ESP32 ficou ~4 min sem rede em cada (o roteador demora
  a voltar e oscila antes de estabilizar). Fila máxima 51–58 leituras; esvaziou em
  6,5 min, 2 min e 1,3 min após reconectar. Quatro ensaios (baixa 5, média 2,
  alta 2) feitos com o roteador desligado foram medidos normalmente.
- `entrega.py`: **2282 esperadas, 2282 recebidas, TE = 100%**, 257 pela fila,
  atraso máximo 497,9 s, nenhum reinício. Junto com a rede estável de 28/10
  (676/676), a Tabela 6 está completa.
- **Alerta** (simulador no servidor, `simulador-alerta-06-11.log` lá): T0 do apto
  103 às 10:32:08.191, limite às 11:02:08.191, `VAZAMENTO_PROVAVEL` visível na
  API às 11:02:08.229 (**38 ms**); no app, no polling seguinte (≤ 5 s).

## 6. Problemas reais encontrados

- **Cabo USB desconectou** às 10:34:24 (kernel registrou a re-enumeração): ESP32
  reiniciou no meio da escorva. Log religado no mesmo arquivo; cabo preso.
- **Falhas de HTTPS espontâneas** de manhã (19 no log da calibração: `SSL - The
  connection indicated an EOF`, `start_ssl_client -1`, timeouts), com a API
  respondendo em ~0,1 s ao notebook na mesma rede — problema no lado do ESP32
  (TLS/Wi-Fi), fila chegou a 21. Sumiram depois do reinício do portal (só 17
  falhas no log da tarde, quase todas nas quedas induzidas). Hipótese: estado da
  pilha TLS/heap após horas ligado; não investigado.
- **Pulsos espúrios por movimento:** 106 pulsos (≈ 270 mL) com o operador
  movimentando o protótipo para escorrer depois do média 3; o média 4 seguinte,
  sem nova escorva, deu +100% — refeito.
- **Rajada elétrica:** 275 pulsos em ~2 s (≈ 31 L/min, não físico) 10 s antes do
  média 6 — provável mau contato/interferência no fio de sinal; refeito. Causa
  exata não identificada.
- **Bug nosso na planilha:** observações com vírgula desalinhavam o CSV e
  quebravam o `calibracao.py`; vírgulas trocadas por ";".
- Ensaios refeitos (linhas comentadas com `#` e motivo, nenhum removido por
  critério estatístico): alta 4 (calibração), média 4 e média 6 (validação).

## 7. Outros

- `firmware/README.md`: link do portal (<http://192.168.4.1>), dados móveis,
  ponto decimal no *Pulsos por litro*.

## 8. Validação do artigo (`COPIA-TCCFinal.tex`)

Versão montada por outra instância do Claude a partir do artigo e de
`docs/texto-artigo-06-11.md`. Números conferidos contra `docs/resultados/` e o
firmware (backoff 5–60 s, fila de 200): todos batem. Corrigido no arquivo:

- Critérios de aceitação: CV ≤ 5%, TE ≥ 95% e L_tot ≤ 10 s, adotados porque já
  estavam registrados em 20/10 (`08a4b6a`: PDF do artigo e `progresso.md`), antes
  do 1º ensaio. Tabela de atendimento: CV não atende; TE e L_tot atendem.
- Explicação do viés positivo após a calibração: além do K único, a validação leu
  3,2–5,5 p.p. acima da calibração em todas as faixas (deriva entre sessões).
- Comparação com Barros (2023): removida a afirmação de que as faixas eram
  "representativas do uso residencial" (não eram: 1,1–2,2 L/min).
- Figuras 3 e 4: `width=0.85\textwidth` (com `scale=0.3`, a Figura 3 sairia com ~6 cm).
- Precisão do fabricante: conferida na folha de dados fornecida pelo usuário
  (`S2edf4d866a8740bca3bcd96bdb87e6461.pdf`, raiz do repo). Ela lista modelo,
  5–18 V, 1–30 L/min, rosca G 1/2", ≤ 2,0 MPa, saída alta ≥ 4,6 V a 5 V, ≤ 10 mA,
  −25 a +80 °C e F = 7,5 × Q, e **não informa precisão**. O texto atual ("a folha
  de dados não informa sua precisão") está correto; o "igual à precisão nominal do
  fabricante" da versão de 20/10 estava errado. Os demais dados do sensor citados
  no §2.2 batem com a folha.

## 9. Pendências

1. ~~Figura 2~~ — feita com capturas do celular de 15:33 (`condominio-sindico.jpg`,
   `apto-201-24h.jpg`, `condominio-proprietario.jpg`): 4 aptos Online, 201 com
   24,9 L nas três telas, alerta de vazamento do 103 visível em (a). As barras de
   (b) antes das 11:49 usam o K teórico. Bug cosmético visto em (a): com os selos
   SIMULADO + POSSÍVEL VAZAMENTO, o status "Online" do card é cortado ("On").
2. ~~Figura 3~~ — feita: `docs/figuras/foto-bancada.jpg` (06/11) →
   `figura3-bancada.png` (painel único, sem letra; `figuras.py` ajustado).
   O Expo Go do celular atualizou e passou a exigir o SDK 58 (o app usa o 57):
   sem print pelo Expo Go para a Figura 2(b).
3. Overleaf: §2.6.1, Tabela 2, Tabelas 3–7, Figura 4, §3.1, §3.2–3.4, limitações,
   resumo e conclusão — rascunhos em `docs/texto-artigo-06-11.md`.
4. Deploy do app com o eixo corrigido (Vercel/APK) — opcional para a entrega.
5. Commit.

## 10. Estado do repositório ao final

- Novos: `docs/stack-06-11.md`, `docs/texto-artigo-06-11.md`,
  `docs/resultados/serial-calibracao-06-11.log`, `serial-validacao-06-11.log`,
  `leituras-falhas-06-11.csv`, `tabela3/4/5_*.csv`, `ensaios_calculados.csv`,
  `figura4_erro_por_faixa.png`.
- Alterados: `docs/resultados/ensaios.csv`, `tabela6_entrega.csv`,
  `firmware/README.md`, `docs/progresso.md`.
- Nada commitado.
