# Avanço do sistema — 16/10/2026

> Registro de desenvolvimento do dia. Ver seção "Convenções para o Claude
> Code" do `CLAUDE.md` para o propósito destes arquivos `stack-DD-MM.md`.
> Continua de `docs/stack-15-10.md`. Sessão de Claude Code rodando **no
> próprio servidor** (`homeserver`, ThinkCentre, Ubuntu 24.04.4), seguindo
> `docs/plano-deploy-servidor.md` (Parte C).

## Resumo do dia

Backend + banco no ar no servidor caseiro, com as portas presas a
`127.0.0.1`. O endpoint de registro de usuários foi **fechado** antes de
qualquer exposição pública. Os dados de produção (síndico, apartamento 201 e
sensor real) já estão provisionados. O Cloudflare Tunnel está no ar como
serviço systemd: `https://apitcc.bernardoburigo.com.br` responde pela
internet. Falta reconfigurar o ESP32 e fazer a verificação ponta a ponta.

Em paralelo, o app recebeu seis ajustes visuais (eixos dos gráficos, popup de
usuário no mobile, botão "voltar" após F5) e o firmware ganhou DNS resiliente
(seção 6). Tudo isso foi commitado em `0e73825`.

## 1. Estado encontrado no servidor

- Docker 29.3.1 + Compose v5.1.1, git, openssl e python3 já instalados; o
  usuário já estava no grupo `docker`. O C2 do plano se reduziu a
  `git clone` + `git pull`.
- O clone inicial pegou `c2384a1`, mas o `main` remoto já estava em `5fa5432`
  (o push com `APP_CORS_ALLOWED_ORIGINS` no compose aconteceu logo depois). Um
  `git pull` resolveu.
- Restos da configuração antiga: os containers `playit` (sem `SECRET_KEY`,
  em loop de reinício, sem expor nada) e `watchtower` (em loop de reinício
  porque usa a API Docker 1.25, abaixo do mínimo 1.40 do Docker 29), ambos de
  `/srv/docker/compose/`. **Removidos** com autorização do usuário
  (`docker compose down --rmi all` + pastas `/srv/docker/compose` e
  `/srv/docker/playit`). O Portainer (`0.0.0.0:9000`) e o `zomboid` (parado)
  ficaram como estavam.
- SSH e ufw não foram tocados (decisão do plano).

## 2. Registro de usuários fechado (`X-Admin-Token`)

**Problema:** `POST /api/auth/registrar` era `permitAll()`, resquício das
primeiras sprints. Com a API pública, abria dois buracos:
1. qualquer pessoa criava um SINDICO (com um condomínio próprio, isolado);
2. **mais grave:** qualquer pessoa se registrava como PROPRIETARIO passando o
   `apartamentoId` de um apartamento **sem dono** e ganhava leitura do
   consumo dele (o vínculo era aceito sem nenhuma autorização).

**Solução** (no mesmo padrão do `X-Sensor-Token`): o registro passa a exigir
o header `X-Admin-Token` igual a `app.registro.admin-token`
(env `APP_REGISTRO_ADMIN_TOKEN`).
- A comparação é em tempo constante (`MessageDigest.isEqual`) e acontece
  antes de qualquer consulta, então também não revela quais e-mails existem.
- Token ausente ou errado → 403 (`AcessoNegadoException`). **Com a
  propriedade vazia (o padrão do `application.properties`), o registro fica
  desativado.**
- No `docker-compose.yml`, o padrão de dev é `dev-admin-token`, para o fluxo
  local continuar como antes. Em produção, o valor vem do `.env`.
- `simulador.py provisionar` ganhou `--admin-token` (padrão: env
  `TCC_ADMIN_TOKEN` ou `dev-admin-token`).
- Testes: o `IntegrationTestBase` injeta o token, e um teste novo
  (`registroSemAdminTokenValidoRetorna403`) cobre header ausente, header
  errado e o usuário não sendo criado. **`mvn test`: 43/43**, rodado num
  container `maven:3.9-eclipse-temurin-21` com o socket do Docker para o
  Testcontainers (o servidor não tem JDK).

Arquivos: `config/AppProperties.java`, `usuario/AuthController.java`,
`usuario/AuthService.java`, `application.properties`, `docker-compose.yml`,
`IntegrationTestBase.java`, `PainelIntegrationTest.java`,
`docs/scripts/simulador.py`, `backend/README.md`, `docs/deploy-servidor.md`,
`docs/plano-deploy-servidor.md`.

## 3. Stack de produção

- `.env` (600, fora do git): segredos gerados com `openssl rand`. As senhas
  são hex e o JWT é base64 sem `/+=`, para não quebrar a interpolação do
  compose nem a URL JDBC. `DB_PASSWORD` é igual a `POSTGRES_PASSWORD`. Além
  disso: `APP_CORS_ALLOWED_ORIGINS=https://tcc.bernardoburigo.com.br`,
  `BIND_HOST=127.0.0.1` e `APP_REGISTRO_ADMIN_TOKEN`.
- `docker compose up -d --build` → `/actuator/health` = `{"status":"UP"}`.
- `ss -tln`: 8080, 5435 e 5050 só em `127.0.0.1`.
- CORS: o preflight `OPTIONS /api/auth/login` com
  `Origin: https://tcc.bernardoburigo.com.br` → 200 e
  `Access-Control-Allow-Origin` correto; com uma origem estranha → 403.
  **Correção no plano:** a checagem sugerida, em `/actuator/health`, nunca
  traria o header, porque o CORS só está registrado para `/api/**`
  (`AppConfig.java`).
- Registro sem token → 403. Com o token de dev (`dev-admin-token`) também
  → 403, o que confirma que o valor de produção está ativo.

## 4. Dados de produção (o banco do servidor começou vazio)

Criados pela API: o síndico `sindico@bernardoburigo.com.br` (senha aleatória)
→ "Condomínio TCC" → apartamento 201 → sensor `ESP32-REAL-201`
(`simulado=false`), com sensorId `a3e7cb03-0acb-42a6-8adc-a5038a4e674d`. A
senha, os IDs e o token do sensor estão em `~/tcc-credenciais.txt`
(permissão 600, fora do repositório). O simulador **não** foi rodado em
produção: ele cria usuários com a senha `senha12345`, que está no
repositório, e isso viraria um login público conhecido.

## 5. Cloudflare Tunnel

- `cloudflared` 2026.10.1, instalado pelo repo apt da Cloudflare (`noble main`).
- **Bug real (procedimento):** os comandos com sudo foram colados num
  terminal comum com o prefixo `!`, que só faz sentido dentro do Claude Code.
  No bash, `! cmd` inverte o resultado do comando: o `apt update` "teve
  sucesso", virou falha e o `&& apt upgrade` foi pulado. No comando do
  `cloudflared`, a chave GPG foi gravada, mas o resto da cadeia não rodou.
  Rodar de novo sem o `!` resolveu.
- O `apt upgrade` atualizou o Docker (`docker-ce`, `containerd.io`), o que
  reiniciou os containers. Todos voltaram sozinhos (`restart: unless-stopped`)
  e os binds continuaram em `127.0.0.1`. O sistema pede reboot (`apparmor`),
  que foi adiado por decisão do usuário.
- **DNS:** o painel da Cloudflare já mostrava a zona *Active* quando o
  `a.dns.br` ainda delegava para `sec.dns.br`; minutos depois, a delegação
  passou para `conrad.ns.cloudflare.com`. Resolvedores com cache (como o
  1.1.1.1) seguiram com a resposta antiga por até ~1 h.
- Túnel `tcc-backend` (ID `bed02dcf-d20b-4ed2-a7f4-67d78e307309`): o ingress
  manda `apitcc.bernardoburigo.com.br` → `http://localhost:8080` e termina no
  catch-all `http_status:404`. `ingress validate` ok. O CNAME foi criado com
  `tunnel route dns`.
- O teste em foreground (com `--credentials-file` apontando para
  `~/.cloudflared`) registrou 2 conexões em `gru13`/`gru19`. Pela borda da
  Cloudflare: health → `UP`; preflight CORS de `tcc.bernardoburigo.com.br` →
  200; registro sem token → 403; subdomínio fora do ingress → 530. O
  usuário confirmou o health pelo celular, nos dados móveis.
  - Detalhe: com o corpo inválido, o registro devolve 400 mesmo sem token,
    porque o `@Valid` roda antes da checagem. Não vaza nada útil; ficou
    assim.
- O serviço systemd usa `/etc/cloudflared/{config.yml,<ID>.json}` e roda
  `--no-autoupdate`: `active`, `enabled`, 4 conexões registradas. Depois de
  encerrado o túnel de teste, o serviço sozinho segue respondendo `UP`.

## 6. Ajustes visuais do app (e DNS do firmware)

Levantados pelo usuário com prints do app em produção e no celular
(`docs/screenshots/Captura_de_tela_20261016_*.png`). Todos em `app/src/`.

1. **Eixo X do gráfico de vazão (30 min)** — os rótulos eram gerados por
   ponto (um a cada múltiplo de 5 min) e se sobrepunham. Agora são 6 rótulos
   em posições **fixas** (frações 0, 0,2 … 1 da largura); só o texto `HH:mm`
   muda, interpolado entre a primeira e a última leitura da janela
   (`VazaoChart.tsx`).
2. **Cabeçalho no mobile (< 640 px)** — nome do usuário e "Sair" espremiam o
   título ("Apto 2…"). Agora um botão redondo com ícone de usuário abre um
   popup com nome, papel e "Sair"; com o popup aberto o botão vira "X" e
   fecha (tocar fora também fecha). Ícones em `react-native-svg` (não há
   vector-icons no projeto). Desktop inalterado (`Cabecalho.tsx`).
3. **Eixo X do gráfico de consumo (24 h, 7 d, 30 d) — bug real, 2 tentativas.**
   - *1ª:* `labelComponent` do gifted-charts com `Text` de largura fixa. Piorou:
     o contêiner do rótulo tem a largura da faixa da barra e continuou
     truncando ("0.."); além disso o limite de rótulos (`areaUtil / 40`)
     mostrava só 4 dos 7 dias.
   - *Final:* os rótulos saem do gifted-charts e são desenhados numa linha
     própria, cada `Text` com 32 px, centrado na barra. `rotuloVisivel(i,
     total, maximo)` recebeu o máximo calculado pela largura (≈ 1 rótulo a
     cada 34 px); 7 dias mostra os 7, 24 h e 30 d mostram uma amostra
     (`ConsumoChart.tsx`, `lib/serie.ts`, +1 teste Jest).
4. **Botão "‹" sumia após F5** — o `back` do React Navigation fica
   indefinido sem histórico (a pilha recomeça na tela atual).
   - *1ª:* mostrar o botão em toda tela ≠ `index`, voltando a `/`. Resolveu o
     sumiço, mas após F5 no sensor o "‹" levava a Apartamentos, não ao
     apartamento.
   - *Final:* `CabecalhoDaPilha` (`_layout.tsx`) usa o `apartamentoId` do
     status do sensor (`useStatusDoSensor`, que agora aceita `undefined` e
     tem `enabled`; a mesma query da tela, deduplicada pelo cache) para
     montar `/apartamento/{id}`. Sem histórico e sem dado, cai em `/`.
5. **Firmware — DNS** (`Network.cpp`) — o DNS do roteador falhava de forma
   intermitente para o host da API ("DNS Failed" por minutos, com Wi-Fi e
   NTP ok). `applyDnsServers()` define 1.1.1.1 como principal e o DNS do
   DHCP (ou 8.8.8.8, se o do roteador for vazio/1.1.1.1) como reserva, e é
   reaplicada a cada reconexão porque o DHCP sobrescreve. O loop de
   reconexão foi reorganizado para isso.

**Testes:** `tsc` e Jest 41/41 passam. A suíte e2e (navegador headless) foi
rodada uma vez, *antes* das correções 3 e 4: 26 ok, 7 falhas, 1 ignorado em
34 — pelo menos uma no `sensor.e2e` (espera por `status-OFFLINE`, que existia
no DOM mas estava oculto). A causa **não foi investigada**. O
`app/e2e/cabecalho.e2e.mjs` (botão "‹" após F5 e popup mobile) foi criado e
**ainda não foi executado**. Não há teste novo do firmware para o DNS, e ele
ainda não foi validado no ESP32 com a URL pública. A conferência visual foi
feita pelo usuário: itens 1, 2 e 4 confirmados; 3 corrigido após o 1º retorno
e confirmado depois.

## 7. Pendente

- [ ] Reboot do servidor (pendente por causa do `apparmor`; o túnel e os containers voltam sozinhos)
- [ ] C7: reconfigurar o ESP32 (URL `https://apitcc.bernardoburigo.com.br` + sensorId/token novos) e validar o DNS resiliente no hardware
- [ ] Verificação ponta a ponta (app Web na Vercel, selo REAL, Expo Go em outra rede)
- [ ] Investigar as 7 falhas do e2e e rodar `app/e2e/cabecalho.e2e.mjs`
- [ ] Usuário: teste mais profundo do gráfico de vazão (item 1)

## Estado do repositório

Deploy (seção 2) e ajustes visuais/firmware (seção 6) estão commitados
(`0e73825`, "Aprimoramento Visual do site e app"); árvore de trabalho limpa
ao escrever este registro.
