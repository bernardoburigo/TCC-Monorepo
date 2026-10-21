# app

Dashboard/app de acompanhamento do consumo de água do condomínio. **O mesmo
código gera a versão Web e a Mobile** (Expo Router). Consome a API do
`backend/` e atualiza por **polling** (5–10 s).

**Sprint:** Sprint 4 implementado — validado na **Web** com dados
**simulados**. Ainda **não** foi testado no celular (Expo Go) nem com dados
reais do ESP32 (o dispositivo não estava com o desenvolvedor). Ver seção 5 do
`CLAUDE.md` e `docs/stack-25-09.md`.

## Telas

| Tela | O que mostra |
|---|---|
| **Login** | e-mail/senha; sessão restaurada ao recarregar; 401 (token expirado) leva de volta ao login |
| **Apartamentos** | síndico: todos os apartamentos do condomínio, ordenados por consumo de hoje, com total do condomínio; proprietário: só o seu. Status do sensor (Online/Offline/Sem dados), selo **SIMULADO** e destaque de **possível vazamento** |
| **Apartamento** | consumo de hoje, gráfico de barras por **24 horas / 7 dias / 30 dias** (total, maior hora/dia, toque na barra para o valor), sensores do apartamento e faixa de alerta |
| **Sensor** | vazão atual (L/min), gráfico ao vivo dos últimos 30 min (5 s), medida × recebida, atraso de entrega, origem (**REAL** ou **SIMULADO**) e faixa de alerta |

Capturas de tela (geradas pelos testes e2e, dados **simulados**): `docs/screenshots/`.

O app é **somente leitura**: contas, apartamentos e sensores são criados pela API
(Swagger) ou pelo script `docs/scripts/simulador.py provisionar`.

## Stack (versões fixadas)

Expo SDK 57 · React Native 0.86 · Expo Router 57 · TypeScript 6 · NativeWind
4.2.7 (+ Tailwind 3.4, o que a documentação dele pede) · TanStack Query 5 · Zustand 5 · Axios · date-fns ·
`react-native-gifted-charts` (gráficos em SVG: rodam na Web; o Victory Native
é baseado em Skia, que na Web exige carregar o CanvasKit — não testado aqui) · `expo-secure-store` (celular) / `localStorage` (Web)
para o token.

**Requer Node ≥ 22.13** (React Native 0.86/Metro). O padrão desta máquina é o
Node 20; o `.nvmrc` fixa o 22:

```bash
cd app
nvm use            # lê o .nvmrc (Node 22)
npm install
```

## Como rodar

```bash
docker compose up -d                                   # (na raiz) banco + backend
python3 docs/scripts/simulador.py provisionar          # cria contas/apartamentos/sensores SIMULADOS
python3 docs/scripts/simulador.py historico --horas 48 # histórico para os gráficos de 24 h/7 d
python3 docs/scripts/simulador.py rodar                # leituras em tempo real (a cada 5 s)

cd app && nvm use && npm run web                       # http://localhost:8081
```

Contas criadas pelo simulador (senha `senha12345`):
`sindico.simulado@tcc.com` (vê os 3 apartamentos) e
`proprietario.simulado@tcc.com` (só o apto 101).

A URL da API vem de `EXPO_PUBLIC_API_URL` (ver `.env.example`; padrão
`http://localhost:8080`). O backend libera CORS só para as origens em
`app.cors.allowed-origins` (padrão `localhost:8081` e `:19006`).

### Visualizar sem backend (dados mock)

Para ver as telas sem subir `docker compose`/backend/simulador: crie `.env.local`
com `EXPO_PUBLIC_USE_MOCK_DATA=true` e rode `npm run web` normalmente. Um adapter
Axios (`src/api/mock/`) responde às mesmas rotas da API com dados fictícios
gerados em memória (3 apartamentos, um com alerta de vazamento ativo, para ver
todas as telas). Contas (senha `senha12345`): `sindico.mock@tcc.com` (vê os 3) e
`proprietario.mock@tcc.com` (só o 101).

Esse recurso é isolado do resto do app por design — fica todo em `src/api/mock/`
e é ligado por uma única linha em `src/api/client.ts` (o `adapter` do Axios).
Para remover: apague a pasta `src/api/mock/` e reverta esse trecho de
`client.ts` para `axios.create({ baseURL: API_URL, timeout: 10_000 })`.

### No celular (Expo Go) — ainda não testado

1. Crie `.env.local` com `EXPO_PUBLIC_API_URL=http://<IP-do-PC>:8080`.
2. Libere as portas 8080 e 8081 no firewall do PC
   (`sudo firewall-cmd --add-port=8080/tcp --add-port=8081/tcp`).
3. `npm start` e abra o QR code no Expo Go (celular na mesma rede).

CORS não se aplica ao celular (é restrição só de navegador).

### APK nativo (EAS Build)

O perfil `apk` do `eas.json` fixa as variáveis do build — o EAS **não** lê o
`.env.local` (ignorado pelo git, não vai para o servidor de build):

| Variável | Valor no APK |
|---|---|
| `EXPO_PUBLIC_API_URL` | `https://apitcc.bernardoburigo.com.br` |
| `EXPO_PUBLIC_USE_MOCK_DATA` | `false` |
| `EXPO_PUBLIC_REGISTRAR_LATENCIA` | `false` |

Sem isso, o build sairia com o padrão do código (`http://localhost:8080`, que
no celular não é o servidor). As `EXPO_PUBLIC_*` são embutidas no JavaScript
no build: no bundle de produção o mock vira a constante `false`.

```bash
npx eas-cli init                                  # 1ª vez: vincula o projeto à conta Expo
npx eas-cli build -p android --profile apk        # ou pelo expo.dev (diretório base: app/)
```

Conferência no aparelho: entrar com a conta **real** do síndico. O modo mock
só aceita as contas `*.mock@tcc.com` — se a conta real entrar e o apto 201
aparecer com o selo REAL, o APK está na API de produção.

`android.package` (`br.unesc.tcc.telemetria`, no `app.json`) é a identidade
do app no Android: trocar depois do primeiro build gera outro aplicativo.

### Medir a latência de exibição (Sprint 6)

O artigo (Seção 2.6.3, Equação 5) decompõe a latência em `t_cap` (ESP32/NTP,
`timestampLeitura`), `t_pers` (backend, `recebidoEm`) e `t_exib` (instante em que
a leitura apareceu na tela). Para registrar o `t_exib`:

1. `.env.local` com `EXPO_PUBLIC_REGISTRAR_LATENCIA=true` e `npm run web`.
2. Abrir a tela do sensor e **deixar a aba visível** durante a coleta (o polling
   pausa com a aba em segundo plano, o que inflaria a latência).
3. As leituras da primeira carga (histórico de 10 min) não entram; cada leitura
   que chega depois é registrada uma vez, com o relógio do dispositivo — que
   precisa estar sincronizado por NTP, como o ESP32 e o servidor.
4. "Exportar latência (CSV)" baixa o arquivo lido por
   `docs/scripts/analise/latencia.py`. O buffer fica em memória: recarregar a
   página zera o registro.

Lógica em `src/lib/latencia.ts` (pura, com testes Jest) e
`src/hooks/useRegistroLatencia.ts`.

## Testes

```bash
npm run typecheck   # tsc --noEmit
npm test            # Jest: 46 testes (funções puras: vazão, formatação, séries, eixos, períodos, latência; modo mock)
./e2e/run.sh        # 31 testes e2e em navegador headless (+1 opcional, ver abaixo)
```

O e2e usa o Chromium já baixado em `~/.cache/ms-playwright` (ou
`CHROMIUM_PATH`), sobe o dev server sozinho e exige backend no ar + dados do
simulador (com o simulador **rodando** para os sensores ficarem ONLINE).
Cobre login/sessão, visão por papel (síndico × proprietário), gráficos
**conferidos contra a API com os mesmos parâmetros**, **polling** (uma leitura
injetada aparece na tela sem recarregar), sessão expirada no meio do uso,
falhas de rede, sensor offline e alertas.

```bash
E2E_ALERTA_REAL=1 ./e2e/run.sh e2e/alerta.e2e.mjs  # +1 teste: detecção real de ponta a ponta (veja o comentário no arquivo)
```

## Estrutura

```
src/app/            rotas (Expo Router): login, (app)/index, apartamento/[id], sensor/[id]
src/api/            cliente Axios (JWT + 401), tipos dos DTOs, chamadas por recurso
src/store/auth.ts   sessão (Zustand): restaurar, entrar, sair
src/hooks/          consultas TanStack Query com polling; useAgora (relógio de tela)
src/lib/            funções puras testadas: vazao, format, periodos, serie, eixo, storage
src/components/     ui (Tela/Cartao/Botao/selos/estados), gráficos, banner de alerta
e2e/                testes de navegador + run.sh
```

## Decisões e armadilhas (para a redação)

- **Rótulos vêm do dado, não do seletor.** Ao trocar de período o gráfico
  anterior fica na tela até o novo chegar; o título "Total (7 dias)" era
  trocado antes e exibia o número de 24 h. O dado agora carrega o próprio
  `periodoId` (bug achado pelo e2e ao comparar com a API).
- **`darkMode: 'class'` no Tailwind** só para contornar um erro do runtime web
  do NativeWind ("Cannot manually set color scheme…"); o app é só claro.
- **Um fuso só:** "hoje" e o agrupamento por hora/dia são calculados no
  backend em `America/Sao_Paulo`; o app só formata.
- **Sem estado global de dados:** o servidor é a fonte da verdade; TanStack
  Query cuida de cache/polling. O Zustand guarda só a sessão.
- **Tempo real = polling** (CLAUDE.md §3): 5 s no sensor, 10 s nas listas e
  gráficos; sem polling em segundo plano. SSE/WebSocket ficaram de fora.
- O JWT na Web fica em `localStorage` (exposto a XSS); aceitável no protótipo,
  registrar na redação.
- O e2e nunca reaproveita um dev server já no ar (em modo CI ele não recarrega
  arquivos e serviu código velho); use `E2E_REUSE_SERVER=1` se for o seu
  `npm run web`.
