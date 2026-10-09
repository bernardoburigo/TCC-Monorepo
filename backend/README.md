# backend

API Spring Boot responsável por receber as leituras do ESP32
(`POST /api/leituras`), persistir no PostgreSQL/TimescaleDB e expor os
dados agregados de consumo para o dashboard/app
(`GET /api/apartamentos/{id}/consumo`).

**Stack:** Spring Boot 3.3.5 + Java 21, Spring Web, Spring Data JPA, Flyway,
Spring Security + JWT (jjwt), Lombok, springdoc-openapi (Swagger), Spring
Actuator. Testes com JUnit 5 + Testcontainers (TimescaleDB real em
container). Mapeamento entidade→DTO via métodos estáticos `de(...)` nos
records de resposta (MapStruct foi cogitado no plano da sprint, mas não
compensava para DTOs desse tamanho — removido do `pom.xml`).

**Modelagem de domínio:** Usuario (SINDICO/PROPRIETARIO) → Condominio →
Apartamento → Sensor → Leitura → ConsumoAgregado (ver seção 2 do
`CLAUDE.md`).

**Sprint:** Sprint 2 implementado — entidades, migrações Flyway, CRUD
completo de Condominio/Apartamento/Sensor, autenticação (API key por
sensor + JWT com registro/login), ingestão de leituras com deduplicação e
consulta de consumo agregado on-the-fly. Sprint 3: contrato de ingestão para o
firmware. Sprint 4: endpoints do app (visão por papel, status de sensor,
leituras recentes, CORS, fuso, alerta de vazamento provável, sensores
simulados). Ver seção 5 do `CLAUDE.md` na raiz do repositório.

## Autenticação

- **Sensores (ESP32):** `POST /api/leituras` usa o header `X-Sensor-Token`
  (API key gerada na criação do sensor, retornada uma única vez).
- **Usuários:** JWT via `POST /api/auth/login`, enviado depois como
  `Authorization: Bearer <token>`. Requisição **não autenticada** (sem token,
  token inválido ou expirado) retorna **401**; autenticado **sem permissão**
  retorna **403** — o app depende dessa distinção (401 = refazer login).
- **Papéis:** `SINDICO` (vinculado ao(s) condomínio(s) que criou/registrou;
  gerencia cadastros) e `PROPRIETARIO` (vinculado aos apartamentos
  informados no registro; só consulta o consumo dos seus).

## Endpoints principais

| Método | Path | Autenticação | Descrição |
|---|---|---|---|
| POST | `/api/auth/registrar` | público | cria usuário; `SINDICO` cria um `Condominio` junto (`nomeCondominio`); `PROPRIETARIO` vincula `apartamentoIds` já existentes |
| POST | `/api/auth/login` | público | retorna JWT |
| CRUD | `/api/condominios[/{id}]` | JWT, role `SINDICO` | soft delete |
| CRUD | `/api/apartamentos[/{id}]` (`?condominioId=` na listagem) | JWT, role `SINDICO` | soft delete |
| CRUD | `/api/sensores[/{id}]` (`?apartamentoId=` na listagem) | JWT, role `SINDICO` | POST retorna o `token` do sensor (só nesse momento) |
| POST | `/api/leituras` | header `X-Sensor-Token` | 409 se `sensorId+sequencia+timestamp` repetido |
| GET | `/api/apartamentos/{id}/consumo?inicio=&fim=&granularidade=MINUTO\|HORA\|DIA` | JWT (síndico do condomínio ou dono do apartamento) | agregação on-the-fly a partir de `leitura`, agrupada no fuso `app.timezone` (`America/Sao_Paulo`) |
| GET | `/api/me` | JWT (qualquer papel) | usuário autenticado (`id, nome, email, role`) |
| GET | `/api/me/apartamentos` | JWT (qualquer papel) | lista do app: SINDICO vê todos os apartamentos ativos dos seus condomínios, PROPRIETARIO só os seus; cada linha traz `consumoHojeMl`, `qtdSensores`, `status`, `ultimaLeituraEm`, `simulado` |
| GET | `/api/apartamentos/{id}/sensores` | JWT (síndico do condomínio ou dono) | sensores ativos com `status` (`ONLINE`/`OFFLINE`/`SEM_DADOS`), `simulado` e última leitura |
| GET | `/api/sensores/{id}/status` | JWT (síndico do condomínio ou dono) | mesmo formato, para um sensor |
| GET | `/api/sensores/{id}/leituras?minutos=30` | JWT (síndico do condomínio ou dono) | leituras brutas dos últimos N min (padrão 30; limitado a 1–240), em ordem cronológica — gráfico "ao vivo" |
| GET | `/api/apartamentos/{id}/alertas` | JWT (síndico do condomínio ou dono) | alertas **ativos** (hoje só `VAZAMENTO_PROVAVEL`), calculados sob demanda |

Swagger UI: `http://localhost:8080/swagger-ui.html`.

### Endpoints do app (Sprint 4)

- **Regras:** "hoje" = desde 00:00 em `America/Sao_Paulo` (calculado no
  backend). Sensor **ONLINE** = última leitura *recebida* (`recebido_em`) há
  ≤ 30 s (`app.sensor.offline-apos-segundos`); mais antiga = `OFFLINE`; sem
  leituras = `SEM_DADOS`. No apartamento, um sensor online basta para `ONLINE`,
  e `simulado` é `true` se **qualquer** sensor for simulado (`sensor.simulado`,
  migração V8, informado em `POST /api/sensores`).
- **Fuso do agrupamento:** o "dia" do gráfico é o dia civil de São Paulo, não o
  UTC do container (senão o dia viraria às 21h).
- **CORS:** origens do app Expo Web em `app.cors.allowed-origins` (padrão
  `http://localhost:8081` e `:19006`; env `APP_CORS_ALLOWED_ORIGINS`). O app
  mobile não é afetado (CORS é restrição só de navegador).
- **Alinhamento do início:** `GET .../consumo` alinha `inicio` ao começo do
  intervalo (minuto/hora/dia em `app.timezone`) e devolve o valor alinhado;
  senão "últimos 7 dias" às 19h traria o primeiro dia só das 19h em diante e o
  gráfico mostraria uma barra parcial parecendo consumo baixo.
- **401 x 403:** não autenticado (sem token, inválido ou **expirado**) = 401;
  autenticado sem permissão = 403.
- **Propriedades:** `app.timezone`, `app.cors.allowed-origins`,
  `app.sensor.offline-apos-segundos`, `app.alerta.fluxo-continuo-minutos`,
  `app.alerta.lacuna-maxima-segundos` (ver `config/AppProperties`; env
  `APP_*`, ex.: `APP_ALERTA_FLUXO_CONTINUO_MINUTOS`, exposta no
  `docker-compose.yml`).

### Alerta de vazamento provável

Regra (`alerta/DetectorFluxoContinuo`, lógica pura): **todas** as janelas de
leitura com pulsos, sem lacuna maior que 15 s entre elas, por **≥ 30 min**, e
com a última leitura recente (sensor comunicando). Uso normal de água tem
pausas; vazamento escoa o tempo todo. Não há tabela de alertas: são calculados
a cada consulta a partir de `leitura`. Para não pesar a lista, uma única
consulta descarta os sensores que tiveram alguma janela sem fluxo no último
intervalo (a grande maioria) e só os demais têm as leituras carregadas.

**Limitação conhecida:** o YF-S201 mede mal vazões muito baixas (abaixo de
~1 L/min pode haver janelas de 5 s sem pulso mesmo com a água correndo).
Gotejamento lento pode "piscar" em zero e quebrar a continuidade: a regra pega
vazamentos francos, não pingos. Ajustar exige dados de bancada (Sprint 6).

Para ver o alerta rápido numa demonstração:
`APP_ALERTA_FLUXO_CONTINUO_MINUTOS=2 docker compose up -d backend` e
`python3 docs/scripts/simulador.py rodar --perfil 103=vazamento`.

### Contrato de `POST /api/leituras` (usado pelo firmware, Sprint 3)

- `pulsos` e `volumeMlEstimado` são o **delta da janela de envio**, não o
  acumulado: o consumo é `SUM(volume_ml_estimado)`.
- `timestampLeitura` é o **fim da janela** (UTC, ISO-8601, ms e `Z`);
  `recebido_em` é gravado pelo banco, então a latência é
  `recebido_em − timestamp_leitura`.
- Janelas sem fluxo chegam com `pulsos=0` / `volumeMlEstimado=0` (heartbeat).
- O firmware ramifica pelo status:

| Status | Quando | O firmware... |
|---|---|---|
| 201 | leitura gravada | remove da fila |
| 409 | `sensorId+sequencia+timestamp` repetido | trata como sucesso (reenvio) |
| 400 | header `X-Sensor-Token` ausente, JSON malformado ou campo inválido | descarta a leitura |
| 401 | token inválido, sensor inativo ou `sensorId` ≠ token | erro de configuração, tenta em 60 s |

## Como rodar

Junto com o banco (via Docker Compose, a partir da raiz do monorepo):

```bash
docker compose up --build
```

O backend roda as migrações Flyway automaticamente ao subir. Actuator em
`http://localhost:8080/actuator/health`.

Ou isoladamente, fora do container (requer Java 21+, Maven e um Postgres
acessível via `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`):

```bash
mvn spring-boot:run
```

## Testes

```bash
mvn test
```

Sobe um container TimescaleDB real via Testcontainers e roda um teste de
integração de ponta a ponta: registro de síndico (cria condomínio) →
login → criar apartamento/sensor → ingestão de leitura → rejeição de
duplicata (409) → rejeição de token inválido (401) → registro de
proprietário vinculando o apartamento → consulta de consumo como síndico e
como dono (200) → consulta de consumo por outro síndico (403).

`PainelIntegrationTest` (13 testes) cobre os endpoints do app: 401 x 403,
visão por papel (síndico x proprietário x síndico de outro condomínio),
status/consumo de hoje, leituras recentes, agrupamento por dia no fuso de São
Paulo (leitura às 01:00Z cai no dia anterior), granularidade `MINUTO`, preflight
CORS, alinhamento do início do intervalo e a flag `simulado`;
`StatusSensorTest` cobre a regra ONLINE/OFFLINE. `DetectorFluxoContinuoTest`
(9, sem banco) cobre a regra de vazamento (limite, pausa, lacuna, sensor sem
dado recente) e `AlertaIntegrationTest` (5, limite reduzido para 2 min) cobre a
API, o painel e a autorização. Total: **42 testes**.

`IngestaoFirmwareIntegrationTest` cobre o contrato de ingestão do ponto de
vista do firmware (JSON como texto, timestamp com ms e `Z`, `pulsos=0`):
201, 409 no reenvio, 401 com token inválido e 400 com header ausente ou JSON
malformado.
