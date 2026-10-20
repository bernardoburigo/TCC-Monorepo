# docs

Diagramas de arquitetura, resultados dos testes de bancada (Sprint 6),
scripts de análise (Python/pandas) usados para calcular as métricas de
validação do TCC, e o histórico de avanço do desenvolvimento.

**Conteúdo:**
- `scripts/simulador.py` — simulador de sensores (dados **SIMULADOS**), usado no
  Sprint 4 enquanto o ESP32 não está disponível. Ver o cabeçalho do script.
- `scripts/analise/` — scripts Python/pandas da Sprint 6 (calibração/EPM/CV,
  taxa de entrega, latência) que geram as Tabelas 3–7 e a Figura 4 do
  artigo. Ver o `README.md` da pasta.
- `paridade-artigo-19-10.md` — comparação do artigo com o repositório, com
  as correções de texto sugeridas.
- `screenshots/` — capturas do app geradas pelos testes e2e (dados simulados).
- `progresso.md` — checklist vivo de progresso por sprint (o que já foi
  concluído e o que falta até a entrega do artigo); atualizar ao fechar
  cada sprint ou pendência relevante.
- `deploy-servidor.md` — guia autocontido do deploy público (servidor
  caseiro + Cloudflare Tunnel + Vercel), pensado pra ser seguido por uma
  sessão de Claude Code rodando no próprio servidor.
- `TCC_Bernardo_Goulart_Búrigo.pdf` — versão final do artigo (textos em
  vermelho = placeholders a preencher com dados da parte prática).

**Conteúdo previsto:**
- Diagramas de arquitetura e modelagem de domínio (ver seção 2 do
  `CLAUDE.md`).
- `resultados/` — CSVs da bancada e as tabelas/figuras geradas pelos
  scripts de `scripts/analise/` (Sprint 6).
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
