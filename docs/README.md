# docs

Diagramas de arquitetura, resultados dos testes de bancada (Sprint 6),
scripts de análise (Python/pandas) usados para calcular as métricas de
validação do TCC, e o histórico de avanço do desenvolvimento.

**Conteúdo:**
- `scripts/simulador.py` — simulador de sensores (dados **SIMULADOS**), usado no
  Sprint 4 enquanto o ESP32 não está disponível. Ver o cabeçalho do script.
- `screenshots/` — capturas do app geradas pelos testes e2e (dados simulados).
- `progresso.md` — checklist vivo de progresso por sprint (o que já foi
  concluído e o que falta até a entrega do artigo); atualizar ao fechar
  cada sprint ou pendência relevante.
- `TCC_Bernardo_Goulart_Búrigo.pdf` — versão final do artigo (textos em
  vermelho = placeholders a preencher com dados da parte prática).

**Conteúdo previsto:**
- Diagramas de arquitetura e modelagem de domínio (ver seção 2 do
  `CLAUDE.md`).
- CSVs e notebooks/scripts para Erro Absoluto (EA), Erro Percentual Médio
  (EPM), desvio padrão, tempo de atualização e taxa de entrega (ver seção
  7 do `CLAUDE.md`).
- Material de apoio para a redação final e apresentação da defesa.

## Histórico de avanço (`stack-DD-MM.md`)

Cada arquivo `stack-DD-MM.md` (data no formato dia-mês, ex.: `stack-10-09.md`
para 10/09/2026) é um registro do que foi desenvolvido/corrigido numa
sessão de trabalho relevante: entregas, decisões técnicas e bugs reais
encontrados ao rodar o código (não só o que foi planejado). Um arquivo por
dia com progresso — se já existir um para a data, complementar em vez de
criar outro.

Servem como diário de bordo do projeto e são insumo direto para o
capítulo de desenvolvimento/resultados do TCC, já que mostram a evolução
passo a passo (incluindo dificuldades e como foram resolvidas). Ver
convenção completa na seção 9 do `CLAUDE.md`.
