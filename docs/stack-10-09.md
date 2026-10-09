# Avanço do sistema — 10/09/2026

> Registro de desenvolvimento do dia. Ver seção "Convenções para o Claude
> Code" do `CLAUDE.md` para o propósito destes arquivos `stack-DD-MM.md`.

## Resumo do dia

Em uma única sessão, o projeto saiu do zero (apenas o `CLAUDE.md` com o
plano de ação) para os **Sprints 0, 1 e 2 concluídos e verificados**:
ambiente Docker rodando, firmware compilando e testado, e um backend
completo (autenticação, CRUD, ingestão e consulta de consumo) com testes
de integração passando contra um banco real.

Todo o código foi efetivamente **compilado, testado e executado** durante
a sessão — não apenas escrito. Isso importa para o relato metodológico:
vários bugs reais só apareceram ao rodar de verdade (detalhados abaixo) e
foram corrigidos na hora.

## 0. Scaffolding inicial do monorepo

Antes dos sprints, foi criada a estrutura de pastas descrita na seção 4 do
`CLAUDE.md`:

- `.claude/settings.json` — configuração local do Claude Code.
- `firmware/`, `backend/`, `app/`, `docs/` — cada uma com um `README.md`
  resumindo propósito, stack e em qual sprint começa a ser preenchida.

## 1. Sprint 0 — Setup (Docker Compose)

**Entregue:** `docker-compose.yml` na raiz com 3 serviços:

- `db` — `timescale/timescaledb:latest-pg16` (Postgres 16 + TimescaleDB),
  volume nomeado, healthcheck via `pg_isready`.
- `backend` — esqueleto Spring Boot mínimo (Web + Actuator) buildado via
  `backend/Dockerfile` (multi-stage: `maven:3.9-eclipse-temurin-21` →
  `eclipse-temurin:21-jre`).
- `pgadmin` — `dpage/pgadmin4`.

**Problemas reais encontrados e corrigidos:**

1. **Rede bridge do Docker sem saída para a internet** neste ambiente —
   o build do backend falhava ao baixar dependências Maven
   (`Temporary failure in name resolution`), mesmo o daemon Docker
   conseguindo baixar imagens normalmente. Diagnosticado comparando
   `docker run --network host` (funciona) vs. rede bridge padrão (não
   funciona). Corrigido adicionando `network: host` ao `build:` do
   serviço `backend` no compose — inofensivo em máquinas normais.
2. **E-mail do pgAdmin rejeitado:** `admin@tcc.local` foi recusado por
   `.local` ser um TLD reservado; trocado para `admin@tcc.com`.

**Verificação:** `docker compose up --build -d` — os 3 containers sobem e
ficam `healthy`; `GET /actuator/health` retorna `{"status":"UP"}`.

## 2. Sprint 1 — Firmware isolado (ESP32, sem hardware conectado)

Como o ESP32 físico não está disponível nesta máquina, o objetivo foi
**desenvolver e validar o firmware sem fazer upload para nenhuma placa**.

**Entregue** (projeto PlatformIO em `firmware/`):

- `platformio.ini` — ambiente `esp32dev` (build) + `native` (testes no
  host, sem hardware).
- `include/config.h` — pino do sensor, constante de calibração
  (`PULSES_PER_LITER`, valor de datasheet — precisa recalibrar por
  sensor), intervalo de amostragem. Nada hardcoded na lógica.
- `lib/FlowMeter/` — conversão pulsos → vazão/volume isolada em C++ puro
  (sem `Arduino.h`), para ser testável nativamente.
- `src/main.cpp` — `attachInterrupt()` contando pulsos do YF-S201, cálculo
  a cada 1s, impressão no Serial (sem Wi-Fi, conforme escopo da sprint).
- `test/test_flow_meter/` — 4 testes Unity validando a fórmula do
  datasheet (7,5 Hz por L/min ⇔ 450 pulsos/L).

**Ferramental:** PlatformIO CLI instalado via `pip install --user
platformio` (não estava presente na máquina).

**Verificação real:**
- `pio test -e native` → 4/4 testes passando.
- `pio run -e esp32dev` → build **SUCCESS** contra o toolchain real do
  ESP32 (Flash 20,7%, RAM 6,7%), sem nenhum `-t upload`.

**Pendente:** upload real e calibração com proveta/cronômetro — dependem
do ESP32 físico estar conectado.

## 3. Sprint 2 — Backend + banco

A sprint mais pesada do dia. Como o plano de ação só descrevia o escopo em
alto nível, várias decisões de regra de negócio foram levantadas e
confirmadas antes de implementar (autenticação, papéis de usuário,
autorização, formato do endpoint de consumo, deduplicação de leituras —
ver histórico da conversa para o detalhe de cada decisão).

**Modelagem implementada** (`backend/src/main/java/br/unesc/tcc/backend/`):

```
Usuario (SINDICO | PROPRIETARIO) --- Condominio --- Apartamento --- Sensor --- Leitura (hypertable)
                                                                                    |
                                                                          ConsumoAgregado (estrutura pronta,
                                                                           job de preenchimento fica p/ depois)
```

7 migrações Flyway (`db/migration/V1` a `V7`), incluindo
`create_hypertable('leitura', 'timestamp_leitura')`.

**Segurança:**
- JWT (`jjwt`) para `SINDICO`/`PROPRIETARIO` via `POST /api/auth/registrar`
  e `POST /api/auth/login`.
- API key por sensor (header `X-Sensor-Token`, gerada na criação do
  sensor) para o ESP32 autenticar `POST /api/leituras` sem precisar de
  login.

**Endpoints:** CRUD completo de Condominio/Apartamento/Sensor (soft
delete, autorização por dono), ingestão de leituras com rejeição de
duplicata (`sensorId+sequencia+timestamp` repetidos → 409), e
`GET /api/apartamentos/{id}/consumo` com agregação on-the-fly
(período + granularidade hora/dia), liberado para o síndico do condomínio
ou o dono do apartamento.

**Testes:** um teste de integração (Testcontainers, TimescaleDB real)
cobrindo o fluxo ponta a ponta — registrar síndico → login → criar
apartamento/sensor → ingerir leitura → rejeitar duplicata → rejeitar token
inválido → registrar proprietário → consultar consumo (síndico e dono,
200) → consultar consumo como síndico de outro condomínio (403).

### Bugs reais encontrados e corrigidos (relevante para a redação)

Todos descobertos rodando o código de verdade, não em revisão estática:

1. **API do JJWT incompatível:** `JwtService` usava a API antiga
   (`Jwts.parserBuilder()`, de JJWT 0.11.x) com a versão 0.12.6 declarada
   no `pom.xml`, que renomeou os métodos. Corrigido para a API fluente
   nova (`Jwts.parser().verifyWith(...)`).
2. **Testcontainers incompatível com o Docker Engine 29.x do host:** a
   versão 1.20.3 negociava a API do Docker a partir de uma baseline
   antiga (1.32), rejeitada pelo daemon (mínimo 1.40). Corrigido
   atualizando para `testcontainers-bom` 1.21.4.
3. **Container Postgres compartilhado indevidamente entre classes de
   teste:** o campo `static @Container` estava numa superclasse abstrata
   herdada por duas classes de teste — JUnit5 parava o container ao fim
   da primeira classe, quebrando a segunda. Corrigido com o padrão
   "singleton container" do Testcontainers (`static { postgres.start();
   }`, sem `@Testcontainers`/`@Container`).
4. **Bug conhecido do `HttpURLConnection` do JDK:** `SimpleClientHttpRequestFactory`
   falhava com `"cannot retry due to server authentication, in streaming
   mode"` ao ler respostas de erro (409, 401) de um POST com corpo.
   Corrigido trocando para `JdkClientHttpRequestFactory`
   (`java.net.http.HttpClient`) no `RestTemplate` de teste.
5. **`LazyInitializationException` mascarada como 403:** métodos de
   consulta sem `@Transactional` acessavam associações `LAZY`
   (`apartamento.getCondominio().getSindico()`) fora de uma sessão
   Hibernate aberta (`spring.jpa.open-in-view=false`). A exceção não
   tratada caía no dispatch `/error`, que o Spring Security barrava
   (não estava em `permitAll()`), resultando num 403 enganoso em vez do
   erro real. Corrigido adicionando `@Transactional(readOnly = true)` nos
   métodos de leitura afetados em `ConsumoService`, `CondominioService`,
   `ApartamentoService` e `SensorService`.
6. **`criadoEm` retornando `null` na criação:** `@CreationTimestamp` só é
   preenchido no flush, que num método `@Transactional` só ocorre no
   commit — depois do DTO de resposta já ter sido montado. Corrigido
   trocando `save()` por `saveAndFlush()` nos três `criar()` (Condominio,
   Apartamento, Sensor).
7. **Dependência não utilizada:** MapStruct entrou no plano da sprint mas
   os DTOs ficaram simples o bastante para métodos estáticos `de(...)`;
   removido do `pom.xml` para não deixar peso morto.

**Verificação real (três camadas):**
1. `mvn clean test` — Testcontainers sobe um TimescaleDB real, 2/2 testes
   passando.
2. `docker compose up --build -d` na raiz — os 3 serviços sobem, Flyway
   roda as 7 migrações automaticamente, `/actuator/health` mostra o banco
   `UP`.
3. Fluxo manual completo via `curl` contra o `docker compose` real:
   registro → login → criar condomínio/apartamento/sensor → ingestão →
   consulta de consumo — todos retornando os dados esperados.

## Estado atual do repositório

```
.claude/settings.json
CLAUDE.md
docker-compose.yml
firmware/        Sprint 1 completo (compila e testa sem hardware)
backend/         Sprint 2 completo (compila, testa e roda via Docker Compose)
app/             ainda não iniciado (Sprint 4)
docs/            este arquivo + README
```

Sprints 0, 1 e 2 da seção 5 do `CLAUDE.md` estão marcados como concluídos.
Próximo passo mapeado: **Sprint 3 — Integração ESP32 → API**, que depende
do hardware físico estar conectado (upload do firmware + Wi-Fi real).

## Observações para a redação do TCC

- O processo de depuração acima (itens 1–7) é material relevante para uma
  seção de "dificuldades e soluções técnicas" — mostra que a validação não
  foi apenas escrever código, mas rodá-lo contra dependências reais
  (Docker, banco, HTTP) e corrigir problemas de integração genuínos.
- A decisão de separar a lógica de cálculo do firmware (`FlowMeter`) do
  código dependente de hardware (`main.cpp`) para permitir testes
  unitários sem o ESP32 é um ponto de design defensável na redação
  (testabilidade apesar da indisponibilidade de hardware).
- O modelo de autorização (síndico vê o condomínio inteiro, proprietário
  só o seu apartamento) implementa diretamente o problema de pesquisa
  descrito na seção 1 do `CLAUDE.md` (gestor sem visibilidade granular).
