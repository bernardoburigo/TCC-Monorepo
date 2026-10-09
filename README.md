# TCC Monorepo — Telemetria de Consumo de Água

Sistema de telemetria para monitoramento de fluxo de água em condomínios
(ESP32 + YF-S201 → API Spring Boot → PostgreSQL/TimescaleDB → dashboard
Web/Mobile em Expo). Contexto completo do TCC (objetivos, arquitetura,
cronograma de sprints) em [`CLAUDE.md`](CLAUDE.md).

Este README é o passo a passo prático para rodar o sistema localmente. Cada
subpasta tem um README com detalhes específicos: [`firmware/`](firmware/README.md),
[`backend/`](backend/README.md), [`app/`](app/README.md), [`docs/`](docs/README.md).

## Estrutura do repositório

```
firmware/   ESP32 + YF-S201 (PlatformIO) — sem hardware em uso no momento
backend/    API Spring Boot + PostgreSQL/TimescaleDB
app/        dashboard/app Expo (mesmo código gera Web e Mobile)
docs/       diagramas, scripts de análise, simulador de sensores, histórico de sprints
docker-compose.yml   banco + backend + pgAdmin
CLAUDE.md            contexto completo do TCC
```

## Pré-requisitos

- **Docker** + Docker Compose v2 (comando `docker compose`, não `docker-compose`).
- **Node.js ≥ 22.13** via nvm — `app/.nvmrc` fixa a versão (o padrão do sistema
  costuma ser mais antigo; sempre rode `nvm use` dentro de `app/`).
- **Python 3.9+** para o simulador de sensores (só biblioteca padrão, sem `pip install`).
- Opcionais: **Java 21 + Maven** (rodar o backend fora do Docker) e **PlatformIO**
  (firmware — ainda sem hardware disponível para testar).

Como ainda não há ESP32 enviando dados reais (ver `CLAUDE.md`, seção 5), o
banco precisa ser populado por um script simulador — os passos abaixo cobrem
isso.

## Primeira inicialização

### 1. Banco + backend + pgAdmin

```bash
docker compose up -d --build
```

Confirme que subiu certo:

```bash
docker compose ps                        # tcc-db deve estar "healthy"
curl http://localhost:8080/actuator/health   # {"status":"UP", ...}
```

As migrações Flyway rodam automaticamente na subida do backend.

### 2. Popular dados simulados

Sem isso o app fica vazio. O script usa o mesmo payload do firmware real,
marcando tudo como `simulado: true` (selo **SIMULADO** no app):

```bash
python3 docs/scripts/simulador.py provisionar           # síndico, proprietário, condomínio, 3 apartamentos/sensores
python3 docs/scripts/simulador.py historico --horas 48  # histórico para os gráficos de 24h/7d/30d
```

Contas criadas (senha `senha12345`):

| Conta | Vê |
|---|---|
| `sindico.simulado@tcc.com` | os 3 apartamentos |
| `proprietario.simulado@tcc.com` | só o apartamento 101 |

### 3. App Web

```bash
cd app
nvm use          # Node 22, fixado em .nvmrc
npm install
npm run web      # http://localhost:8081
```

Abra `http://localhost:8081` e faça login com uma das contas acima.

### 4. (Opcional) Sensores "Online" e gráfico ao vivo

Status do sensor depende da *última leitura recebida* há ≤ 30 s. Sem um
processo enviando leituras continuamente, os sensores aparecem **Offline**
pouco depois do passo 2. Para vê-los "Online", deixe rodando em outro
terminal:

```bash
python3 docs/scripts/simulador.py rodar   # 1 leitura a cada 5 s por sensor; Ctrl+C para parar
```

## Inicializações seguintes

Os dados do banco persistem entre reinícios (volume Docker `db_data`) — não
é preciso repetir `provisionar`/`historico`:

```bash
docker compose up -d                       # reaproveita o banco existente
python3 docs/scripts/simulador.py rodar    # opcional, para sensores "Online"/ao vivo
cd app && nvm use && npm run web
```

## App no celular (Expo Go) — ainda não testado em hardware real

```bash
sudo firewall-cmd --add-port=8080/tcp --add-port=8081/tcp   # libera as portas no PC
```

Em `app/`, crie `.env.local`:

```
EXPO_PUBLIC_API_URL=http://<IP-do-PC>:8080
```

Depois:

```bash
cd app && nvm use && npm start
```

Escaneie o QR code com o app **Expo Go**, celular na mesma rede Wi-Fi 2,4 GHz
do PC.

## Ver as telas sem subir nada (modo mock)

Para visualizar o app sem Docker/backend/simulador, existe um modo mock —
dados fictícios gerados no próprio app, isolado em `app/src/api/mock/` (fácil
de remover; não afeta o modo normal):

```bash
cd app
echo 'EXPO_PUBLIC_USE_MOCK_DATA=true' > .env.local
nvm use && npm run web
```

Contas (senha `senha12345`): `sindico.mock@tcc.com` (3 apartamentos, 1 com
alerta de vazamento ativo) e `proprietario.mock@tcc.com` (só o 101). Apague
`.env.local` (ou mude a variável para `false`) para voltar ao backend real.
Detalhes em [`app/README.md`](app/README.md#visualizar-sem-backend-dados-mock).

## URLs úteis (com tudo no ar)

| Serviço | URL |
|---|---|
| App Web | http://localhost:8081 |
| API — Swagger UI | http://localhost:8080/swagger-ui.html |
| API — health | http://localhost:8080/actuator/health |
| pgAdmin | http://localhost:5050 (`admin@tcc.com` / `admin`) |
| PostgreSQL/TimescaleDB | `localhost:5435` (usuário/senha/banco: `tcc` / `tcc` / `tcc_telemetria`) |

## Testes

```bash
# backend — sobe um TimescaleDB real via Testcontainers
cd backend && mvn test

# app
cd app
npm run typecheck
npm test            # funções puras (Jest)
./e2e/run.sh         # navegador headless; exige backend no ar + dados do simulador

# firmware — sem hardware
cd firmware
pio test -e native
pio run -e esp32dev
```

## Parar / resetar

```bash
docker compose down      # para os containers, mantém os dados
docker compose down -v   # para e APAGA o banco (próxima subida exige provisionar/historico de novo)
```

## Problemas comuns

- **Porta do Postgres ocupada:** `tcc-db` usa a porta `5435` no host (não a
  `5432` padrão), porque esta máquina já tinha outro Postgres nela; a rede
  interna do Docker (`backend` → `db:5432`) não depende disso. Se `5435`
  também já estiver em uso na sua máquina, troque o mapeamento em
  `docker-compose.yml`.
- **`npm run web` falha ou o Metro não sobe:** confira `node -v` — precisa
  ser ≥ 22.13 (`nvm use` dentro de `app/`).
- **App com telas vazias:** rode `python3 docs/scripts/simulador.py
  provisionar` (e `historico`) pelo menos uma vez.
- **Sensores aparecem "Offline" mesmo com dados no banco:** normal sem o
  `simulador.py rodar` ativo (ver "4. Sensores Online" acima).
- **Celular não acessa a API:** confirme que o PC e o celular estão na mesma
  rede Wi-Fi 2,4 GHz e que as portas 8080/8081 estão liberadas no firewall.

Mais detalhes e decisões técnicas em cada subpasta
([`firmware/`](firmware/README.md), [`backend/`](backend/README.md),
[`app/`](app/README.md), [`docs/`](docs/README.md)) e, para o contexto
completo do TCC, em [`CLAUDE.md`](CLAUDE.md).
