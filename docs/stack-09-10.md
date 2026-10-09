# Avanço do sistema — 09/10/2026

> Registro de desenvolvimento do dia. Ver seção "Convenções para o Claude
> Code" do `CLAUDE.md` para o propósito destes arquivos `stack-DD-MM.md`.
> Continua de `docs/stack-25-09.md` (Sprints 3 e 4 em 🟡, pendentes de
> hardware físico).

## Resumo do dia

Dia sem código de produto novo relevante no firmware/backend/domínio — o
ESP32 continuou indisponível. O trabalho foi: (1) validar se o artigo final
do TCC (PDF entregue pelo orientando) está condizente com o `CLAUDE.md` e as
sprints; (2) colocar o sistema completo (banco + backend + app) para rodar
de ponta a ponta nesta máquina, sem hardware, incluindo um **modo mock**
novo no frontend; (3) criar um `README.md` na raiz do monorepo; (4) destravar
o Expo Go no celular. Também fechado: reestruturação do cronograma da seção
5 do `CLAUDE.md` para o novo prazo de entrega do artigo (09/11/2026) e um
checklist de progresso em `docs/progresso.md`.

## 1. Validação de paridade: artigo final × `CLAUDE.md`

O orientando adicionou `docs/TCC_Bernardo_Goulart_Búrigo.pdf` (20 páginas,
versão final do artigo, com placeholders em vermelho para os dados da parte
prática) e pediu uma auditoria read-only: confirmar que a stack, a
arquitetura e as abordagens do `CLAUDE.md` continuam condizentes com o que
o artigo descreve.

**Achados reais (não placeholders):**
1. A Conclusão do artigo (p.17) lista como limitação "não há alertas
   automáticos" e recomenda "alertas por... fluxo contínuo prolongado" como
   trabalho futuro — mas esse alerta já está implementado e testado desde a
   Sprint 4 (pacote `backend/.../alerta/`, `AlertaIntegrationTest`,
   `app.alerta.fluxoContinuoMinutos`, exibido no app). O texto final
   contradiz o próprio sistema construído.
2. O artigo (p.7) diz "sete migrações" Flyway; o repositório tem **8**
   (`V1`–`V8`, `V8` adicionada na Sprint 4 para `sensor.simulado`). Era
   verdade até a Sprint 2 (`stack-10-09.md` confirma "V1 a V7"), ficou
   desatualizado depois.

**Notas menores:** o artigo generaliza o intervalo de envio do firmware
como "a cada N segundos" (fixo em 5 s desde a Sprint 3); fala em "sete
sprints" (a tabela do `CLAUDE.md` tem 8, Sprint 0 a 7); menciona só
`expo-secure-store` para o token, sem citar o `localStorage` da Web.

**Confirmado:** todo o resto (hardware/firmware, backend, banco,
tempo real por polling, app, metodologia de validação, estratégia
multi-apartamento) bate com o `CLAUDE.md`. Os placeholders vermelhos do PDF
mapeiam exatamente para o que falta coletar (Etapa B da Sprint 3,
calibração da Sprint 1, Sprint 6 formal).

Nenhuma mudança de código decorreu disso — os dois achados reais ficaram
registrados em `docs/progresso.md` (seção "Pendências para o artigo"), para
o orientando ajustar o texto na fonte externa (não há `.tex`/`.docx` no
repo, só o PDF compilado).

## 2. Sistema rodando de ponta a ponta, sem hardware

Pergunta do orientando: já dá para acessar o sistema sem o ESP32? Resposta:
sim, mas o ambiente local estava quebrado.

### Bug real encontrado: stack Docker inconsistente

`docker ps -a` mostrou `tcc-db` (TimescaleDB) **parado** e `tcc-backend` em
**crash loop** (`UnknownHostException: db` nos logs — o backend não
conseguia resolver o hostname interno do Docker porque o container do banco
não estava na rede). Causa raiz: a porta `5432` do host já estava ocupada
por um Postgres de **outro projeto** nesta máquina (`pg-global`), então
`docker compose up -d` falhava ao tentar subir o `tcc-db`.

**Corrigido:** mapeamento de porta do host do serviço `db` alterado de
`5432` para `5435` em `docker-compose.yml` (comentário explicando o porquê
adicionado no arquivo). A rede interna do Docker (`backend` → `db:5432`)
não muda — só afeta acesso externo (ex.: um cliente psql no host). Depois
disso, `docker compose up -d` subiu os 3 containers e `/actuator/health`
voltou a `UP`.

### Dados simulados no backend real

Rodado o fluxo já documentado:
```
python3 docs/scripts/simulador.py provisionar
python3 docs/scripts/simulador.py historico --horas 48
```
8.640 leituras em 3 sensores, condomínio "Condomínio Simulado (TCC)".
Confirmado via `curl` no `GET /api/me/apartamentos` com token real do
síndico simulado — dados batendo (ex.: apto 101 com ~379,9 L hoje). Como o
`simulador.py rodar` (contínuo) não ficou ativo, os sensores aparecem
`OFFLINE` — comportamento esperado (status depende de leitura recebida há
≤ 30 s), documentado no novo README raiz.

## 3. Modo mock no frontend (pedido do orientando)

Pedido: visualizar o app sem precisar de backend/Docker/simulador, da forma
mais **desacoplada** possível (fácil de remover depois). Implementado em
`app/src/api/mock/`:

- `dados.ts` — dataset estático + geradores (2 contas, 3 apartamentos, um
  com fluxo contínuo de "vazamento" para exercitar o alerta; geração de
  consumo/leituras/alertas/status com pequena variação aleatória a cada
  chamada, pra sentir "ao vivo" no polling).
- `adapter.ts` — um **adapter customizado do Axios** que intercepta as
  chamadas (login, `/api/me`, `/api/me/apartamentos`, sensores, consumo,
  leituras, alertas) e responde com os dados de `dados.ts`, replicando as
  regras de autorização reais (síndico vê tudo; proprietário só o seu
  apartamento, 403 se tentar outro).
- `index.ts` — liga/desliga por `EXPO_PUBLIC_USE_MOCK_DATA=true`.

**Único ponto de integração com o código existente:** 2 linhas em
`src/api/client.ts` (import + `adapter: MOCK_ATIVO ? mockAdapter :
undefined` no `axios.create`). Remover o recurso = apagar a pasta
`src/api/mock/` e reverter essas 2 linhas.

Contas mock (senha `senha12345`): `sindico.mock@tcc.com` (3 apartamentos,
1 com alerta ativo) e `proprietario.mock@tcc.com` (só o 101).

### Verificação real

- `npm run typecheck` limpo.
- `npm test` → **40/40** (33 originais + 7 novos em
  `src/api/mock/__tests__/adapter.test.ts`: login válido/inválido, 401 sem
  token, controle de acesso síndico×proprietário, geração de consumo com a
  contagem certa de pontos por período, cenário de vazamento com fluxo
  contínuo e alerta ativo).
- Bundle web compila sem erro (Metro, 1400 módulos).
- Rodado num **Chromium headless real** (reaproveitando `abrirNavegador`/
  `novaPagina`/`entrar` de `app/e2e/helpers.mjs`, num script pontual fora
  do repo): login do síndico mock, lista com os 3 apartamentos ranqueados
  por consumo, selo de vazamento visível no apto 103, controle de acesso do
  proprietário (só vê o 101), zero erros de JavaScript na página.
  Screenshots enviadas ao orientando.

Documentação: `app/.env.example` e `app/README.md` (nova seção
"Visualizar sem backend (dados mock)") atualizados.

## 4. `README.md` na raiz do monorepo

Criado o primeiro README raiz do repositório: passo a passo de primeira
inicialização (docker compose → simulador → app Web) e inicializações
seguintes, app no celular (Expo Go), modo mock, tabela de URLs úteis,
comandos de teste de cada subpasta, como parar/resetar e uma seção de
problemas comuns (porta do Postgres, Node < 22, telas vazias, sensor
"Offline", celular sem acesso). Linka para os READMEs de `firmware/`,
`backend/`, `app/`, `docs/` e para o `CLAUDE.md`.

## 5. Expo Go no celular

### Portas do firewall

Investigado (read-only) o estado do `firewalld` antes de orientar o
orientando a abrir portas: a zona `FedoraWorkstation` (interface `wlo1`,
Wi-Fi) já tinha uma regra **permanente pré-existente** liberando TCP/UDP
`1025-65535` inteiro — não criada nesta sessão, provavelmente resquício de
outros projetos na máquina (`docker ps` mostra vários backends de outros
repositórios). Ou seja, 8080/8081 já estavam abertos; nada foi alterado
aqui, só reportado o achado (a regra é bem mais ampla que o necessário).
Passado o padrão seguro para abrir-e-reverter uma porta pontualmente
(`firewall-cmd --add-port ... --timeout=Nh`, sem `--permanent`, com
alternativa de rich-rule restrita ao IP do celular).

### Bug relatado: "Failed to download remote update" (Expo Go, Android)

Investigação: processo rodando era `expo start --web` (via `npm run web`),
Metro ouvindo em `*:8081` (bind correto). A máquina tem **13 interfaces de
bridge do Docker** (`172.17.0.1` a `172.29.0.1`), todas no mesmo bloco
privado do IP real de Wi-Fi (`172.30.49.242/18`) — hipótese levantada: a
detecção automática de host do Metro poderia estar anunciando um IP de
bridge interna (inacessível do celular) em vez do IP de Wi-Fi real.
Passadas duas correções (`REACT_NATIVE_PACKAGER_HOSTNAME=<ip>` e
`npx expo start --tunnel`) e um teste de diagnóstico (abrir
`http://<ip-wifi>:8081` no navegador do celular).

**Causa real (confirmada pelo orientando):** não foi o IP/Docker — foi a
**rede Wi-Fi da instituição bloqueando a comunicação direta entre
dispositivos** (isolamento de cliente/AP isolation), comum em redes
educacionais. Resolvido pelo orientando (provavelmente via `--tunnel` ou
trocando de rede). Vale registrar como risco ambiental para a redação: em
*campus*/redes institucionais, o fluxo LAN direto (Sprint 3/4) pode não
funcionar, e `--tunnel` ou hotspot do celular são os contornos.

## Pendente

- [ ] Hardware físico (ESP32 + YF-S201) ainda não disponível — bloqueia a
  Etapa B da Sprint 3, a calibração da Sprint 1 e o critério "dados reais"
  da Sprint 4.
- [ ] Ajustar o texto do artigo final nos 2 pontos da seção 1 (ver
  `docs/progresso.md`).
- [ ] Rodar `docs/scripts/simulador.py rodar` quando quiser sensores
  "Online"/ao vivo no backend real (não deixado rodando ao final do dia).

## Estado atual do repositório

```
CLAUDE.md            seção 1 e 5 atualizadas: prazo do artigo (09/11) e cronograma reestruturado
README.md            NOVO — passo a passo de execução do monorepo
docker-compose.yml   porta do host do `db` 5432 -> 5435 (conflito local com outro projeto)
app/src/api/mock/    NOVO — modo mock desacoplado (dados.ts, adapter.ts, index.ts, teste)
app/src/api/client.ts  + 2 linhas (liga o adapter mock quando EXPO_PUBLIC_USE_MOCK_DATA=true)
app/.env.example     + EXPO_PUBLIC_USE_MOCK_DATA
app/README.md        + seção "Visualizar sem backend (dados mock)"
docs/progresso.md    NOVO — checklist de progresso por sprint
docs/stack-09-10.md  este arquivo
backend/, firmware/  sem mudanças de código nesta sessão
```

A stack Docker ficou no ar (`tcc-db` healthy, `tcc-backend` healthy,
`tcc-pgadmin`), com dados simulados no banco (condomínio "Condomínio
Simulado (TCC)", 48 h de histórico). O simulador contínuo (`rodar`) está
**parado**.

## Observações para a redação do TCC

- O achado da validação de paridade (alerta de vazamento omitido/contradito
  no texto final apesar de implementado e testado) é um bom exemplo de
  "documentação desatualizada em relação ao código" — vale uma frase sobre
  isso no processo de escrita, se o capítulo de metodologia discutir o
  fluxo de trabalho.
- O bug do Docker (porta 5432 ocupada por outro projeto) é ambiental, não
  do sistema em si — não citar como limitação do protótipo, é específico
  desta máquina de desenvolvimento.
- O isolamento de cliente em rede institucional (Expo Go) é, esse sim, um
  risco ambiental genuíno e relevante para quando o teste com o ESP32 real
  acontecer em rede de instituição: documentar como limitação de ambiente
  de implantação, não do firmware/app.
