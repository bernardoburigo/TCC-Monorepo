# Avanço do sistema — 25/09/2026

> Registro de desenvolvimento do dia. Ver seção "Convenções para o Claude
> Code" do `CLAUDE.md` para o propósito destes arquivos `stack-DD-MM.md`.
> Continua de `docs/stack-10-09.md` (Sprints 0–2 concluídas).

## Resumo do dia

A **Sprint 3 (Integração ESP32 → API)** foi implementada e validada **até
onde é possível sem o ESP32 físico** (nenhum dispositivo em
`/dev/ttyUSB*`/`/dev/ttyACM*` nesta máquina). Status: 🟡 código pronto,
compilando e testado; a **Etapa B** (upload, calibração da Sprint 1, teste
ponta a ponta com a torneira e testes de queda de rede) continua pendente e é
o que falta para marcar a sprint como ✅.

> **Testes com o ESP32 NÃO foram realizados.** O dispositivo (ESP32 +
> YF-S201) não estava com o desenvolvedor em 25/09/2026, então nenhum
> upload, calibração, teste de portal cativo, teste com torneira ou teste de
> queda de rede foi executado. Tudo o que está descrito abaixo como "validado"
> refere-se a **compilação, testes unitários no host e ao contrato HTTP
> exercitado por curl** — não a medições em hardware real. Esses testes foram
> adiados para quando o dispositivo estiver disponível (ver "Pendente —
> Etapa B").

> **Continuação no mesmo dia:** a **Sprint 4 (Dashboard/App)** foi feita depois da
> Sprint 3 — ver a seção "Sprint 4" no final deste arquivo. O app foi validado
> com dados **simulados**; os testes com o ESP32 continuam **não realizados**.

## Revisão da sprint (antes de codar)

A leitura do código das Sprints 1–2 mudou o desenho em pontos importantes:

1. **O payload é delta por janela, não acumulado.** `ConsumoService` soma
   `volume_ml_estimado`. O `main.cpp` da Sprint 1 acumulava `totalVolumeMl`
   para o Serial; enviar esse valor inflaria o consumo a cada leitura.
   Decisão: cada leitura carrega só `pulsos`/`volumeMlEstimado` da janela;
   o acumulado ficou apenas no Serial (calibração).
2. **`timestampLeitura` = fim da janela**, em UTC com milissegundos e `Z`.
   Assim a latência da Sprint 6 sai direto de `recebido_em −
   timestamp_leitura` (coluna já existente na migração V6).
3. **NTP é pré-condição:** o ESP32 parte de 1970. O firmware só fecha janelas
   de envio com hora válida (pulsos acumulam até lá; consumo preservado).
4. **`sequencia` zera no boot** (fica em RAM). Não conflita com a constraint
   única (o timestamp difere). Limitação aceita: na análise da Sprint 6,
   `sequencia` regredindo indica novo boot.

## Decisões técnicas (confirmadas)

- **Falha de rede:** fila em RAM de 200 leituras (~16 min a 5 s) com reenvio
  em ordem; cheia → descarta a mais antiga e conta em `droppedCount`. Some se
  o ESP32 reiniciar.
- **Cadência:** amostra a 1 s (Serial) e **um POST por janela de 5 s, sempre**,
  inclusive com 0 pulsos (heartbeat + latência mensurável). ~17 mil linhas/dia
  por sensor.
- **Configuração sem segredos no git:** URL da API, `sensorId`, token e
  pulsos/litro na NVS (`Preferences`), editáveis pelo portal cativo do
  WiFiManager. Também cumpre a regra do `CLAUDE.md` §9 (calibração
  configurável): recalibrar não exige recompilar.
- **Política por status HTTP:** `2xx`/`409` → sucesso; `400` → descarta;
  `401` → erro de configuração (recuo direto de 60 s, sem inundar o
  servidor); demais → retenta com recuo exponencial 5→10→20→40→60 s.
- **Transporte:** HTTP puro na LAN nesta sprint; com `https://` o firmware usa
  `WiFiClientSecure` + `setInsecure()`. Validação da cadeia fica para a
  Sprint 7.
- **Padrão da Sprint 1 mantido:** lógica pura em `lib/` (testada no host),
  hardware em `src/`. `LeituraPayload` (JSON + ISO-8601) e `SendQueue` (fila +
  política de status + backoff) são testáveis sem placa.
- **Versões fixadas** em `platformio.ini` (`espressif32@7.1.2`,
  `WiFiManager@2.0.17`, `ArduinoJson@7.4.3`) para build reprodutível.

## Entregue

**Backend** (`backend/`):
- `SecurityConfig`: `/error` em `permitAll()`.
- `GlobalExceptionHandler`: `MissingRequestHeaderException` e
  `HttpMessageNotReadableException` → 400.
- Novo `IngestaoFirmwareIntegrationTest` (5 testes): payload no formato exato
  do firmware → 201; reenvio → 409; token inválido → 401; header ausente →
  400; JSON malformado → 400.
- Helpers `registrar`/`logar`/`autenticado` movidos de
  `FluxoCompletoIntegrationTest` para `IntegrationTestBase` (reuso).
- `backend/README.md`: contrato de ingestão e tabela de status.

**Firmware** (`firmware/`):
- `lib/LeituraPayload/`, `lib/SendQueue/` (novas, puras) + 19 testes novos.
- `src/DeviceConfig.*` (NVS), `src/Network.*` (WiFiManager, NTP, POST
  HTTP/HTTPS, botão BOOT), novo `src/main.cpp` (ISR → janela de 1 s →
  janela de 5 s → fila → 1 POST por iteração).
- `include/config.h` com todas as constantes novas; `platformio.ini` com
  `lib_deps` por ambiente.

## Bugs reais encontrados

1. **`403` enganoso no endpoint de ingestão (backend).** Reproduzido com curl
   antes de corrigir: `POST /api/leituras` sem o header `X-Sensor-Token` e com
   JSON malformado retornavam **403**, não 400. Causa: os erros gerados pelo
   próprio Spring MVC saem por `sendError` → dispatch `/error`, que o Spring
   Security barrava por não estar em `permitAll()` — mesma família do bug nº 5
   de 10/09. Importa porque o firmware decide pelo status (400 = descartar,
   401 = erro de configuração). Corrigido e coberto por teste; reconfirmado
   por curl contra o `docker compose` reconstruído.
2. **Premissa errada no plano: reset por "BOOT no boot".** O GPIO0 segurado
   durante o reset coloca o ESP32 no modo de download (o firmware nem roda).
   O reset de credenciais passou a ser "segurar BOOT por 3 s **com o firmware
   rodando**", que apaga o Wi-Fi salvo e reinicia no portal.
3. **Backoff:** o plano dizia 5→10→20→60 s; a implementação é duplicação
   limitada a 60 s (5→10→20→40→60), testada em `test_send_queue`.

## Verificação real (o que foi de fato executado)

- `pio test -e native` → **23/23** (4 da Sprint 1 + 19 novos).
- `pio run -e esp32dev` → **SUCCESS**, sem warnings nos arquivos do projeto
  (Flash 80,3% de 1,31 MB, RAM 16,6%) — sem upload.
- `mvn test` → **7/7** (Testcontainers com TimescaleDB real): 2 antigos + 5
  novos. Confirmado pelos relatórios do Surefire.
- **Contrato ponta a ponta sem hardware:** o JSON foi gerado pelo código
  **real** de `lib/LeituraPayload` (compilado no host) e enviado por curl ao
  backend no `docker compose` reconstruído: `201` (com fluxo), `409` (mesmo
  POST), `201` (heartbeat com 0 pulsos), `401` (token errado), `400` (sem
  header), `400` (JSON quebrado). O registro apareceu no banco com
  milissegundos preservados e `GET /api/apartamentos/{id}/consumo` devolveu o
  volume esperado (82,2222 mL; o heartbeat não distorce a soma).

## Pendente — Etapa B (requer o ESP32 físico) — NÃO REALIZADA

Nenhum item abaixo foi executado em 25/09/2026: o ESP32 não está com o
desenvolvedor. Os itens seguem em aberto e devem ser feitos (e registrados em
novo `stack-DD-MM.md`) assim que o dispositivo estiver disponível.

- [ ] Upload (`pio run -e esp32dev -t upload`; usuário no grupo `dialout`).
- [ ] Medir com multímetro que o sinal do YF-S201 ≤ 3,3 V antes de ligar ao GPIO27.
- [ ] Liberar a porta no host: `sudo firewall-cmd --add-port=8080/tcp`; anotar o IP do PC (muda por DHCP).
- [ ] Calibração da Sprint 1 (proveta + cronômetro) e gravar pulsos/litro pelo portal.
- [ ] Portal cativo: configurar Wi-Fi 2,4 GHz, URL, `sensorId`, token.
- [ ] Abrir a torneira → linhas em `leitura` em ≲ 6 s; `GET .../consumo` reflete o volume; soma dos volumes ≈ proveta (guardar o erro: dado da Sprint 6).
- [ ] Queda de rede: desligar o Wi-Fi ~60 s e, separado, parar o container do backend ~30 s → ao voltar, `sequencia` contígua, sem duplicatas, latência alta nas leituras atrasadas.
- [ ] Token errado → 401 logado sem inundar (recuo de 60 s); reiniciar o ESP32 → `sequencia` volta a 0 e o envio segue.

## Estado atual do repositório

```
CLAUDE.md        Sprint 3 marcada 🟡; dependências, semântica do payload e riscos atualizados
docker-compose.yml   (sem mudanças) — stack no ar: tcc-db, tcc-backend, tcc-pgadmin
firmware/        Sprint 3 código pronto (compila e testa sem hardware)
backend/         + correção 403→400 e testes de contrato do firmware
app/             ainda não iniciado (Sprint 4)
docs/            stack-10-09.md, stack-25-09.md
```

O banco de desenvolvimento contém dados criados pelo teste de contrato via
curl (síndico `sindico-sprint3-1790377719@teste.com`, apartamento 101, sensor
`389a0887-f0fe-4e22-9237-5ad960b47c15`, 2 leituras). Para a Etapa B, crie um
sensor novo pela API/Swagger (o token só aparece na criação) ou zere o banco
com `docker compose down -v`.

## Observações para a redação do TCC

- A decisão "delta por janela + timestamp de fim de janela" é o que torna as
  métricas da Sprint 6 calculáveis direto do banco (consumo = soma; latência =
  `recebido_em − timestamp_leitura`; entrega = continuidade de `sequencia`).
- A escolha de **fila em RAM com reenvio** muda a leitura da "taxa de entrega":
  perdas na rede viram *latência* (leitura atrasada), não *ausência* de dado;
  só estouro da fila (`droppedCount`) ou reinício do ESP32 geram perda real.
  Explicitar isso ao apresentar a métrica.
- O portal cativo + NVS permite calibrar cada sensor individualmente sem
  recompilar, atacando o risco de calibração do YF-S201 descrito na seção 8
  do `CLAUDE.md`.
- O `403` enganoso é mais um exemplo (junto do nº 5 de 10/09) de defeito que só
  aparece ao rodar contra o servidor real, e que só importa porque o cliente
  embarcado ramifica pelo código de status.

---

# Sprint 4 — Dashboard/App (mesmo dia, 25/09)

## Resumo

O app (Expo, Web + Mobile) foi implementado e **validado na Web com dados
simulados**: login, lista de apartamentos, gráfico de consumo, detalhe do
sensor ao vivo e alerta de vazamento provável. Status: 🟡.

> **O que NÃO foi feito:** (1) **nenhum teste com o ESP32** — o dispositivo não
> está com o desenvolvedor; todo dado exibido pelo app é **SIMULADO**
> (`docs/scripts/simulador.py`, sensores com `simulado = true`, selo SIMULADO
> no app), então o critério da sprint "dados **reais** do sensor no gráfico"
> segue **pendente**, junto com a Etapa B da Sprint 3 e a calibração da
> Sprint 1; (2) **teste no celular (Expo Go)** — só a versão Web foi exercitada.

A sprint foi dividida em sub-tasks (S4.0–S4.10). A S4.10 (alerta) foi feita
antes do fechamento (S4.9) para a documentação final refletir tudo.

## Decisões de negócio (confirmadas com o usuário)

- **Alerta de vazamento por regra mínima**, como sub-task final e cortável:
  fluxo ininterrupto ≥ 30 min (o diferencial do TCC, "alertas imediatos", não
  estava em nenhuma sprint nem no backend).
- **App somente leitura:** sem telas de cadastro (contas/apartamentos/sensores
  continuam pela API/Swagger ou pelo simulador).
- **Coluna `sensor.simulado`** (migração V8) + selo no app, em vez de convenção
  de nome: real × simulado vira dado consultável na análise da Sprint 6.

## Decisões técnicas

- **Backend não servia o app:** `condominios`/`apartamentos`/`sensores` eram
  só do SINDICO, então um PROPRIETARIO não conseguiria listar nem o próprio
  apartamento. Novos endpoints (qualquer papel, regra "síndico do condomínio
  ou dono"): `/api/me`, `/api/me/apartamentos`, `/api/apartamentos/{id}/sensores`,
  `/api/sensores/{id}/status`, `/api/sensores/{id}/leituras`,
  `/api/apartamentos/{id}/alertas`. A regra de acesso foi extraída para
  `AcessoApartamentoService` (reuso).
- **Fuso:** "hoje" e o agrupamento hora/dia em `America/Sao_Paulo`
  (`date_trunc(g, ts, tz)`), calculados no backend; o app só formata.
- **Início do intervalo alinhado** ao começo da hora/dia (senão o primeiro dia
  de "7 dias" vinha parcial e parecia consumo baixo).
- **Status do sensor** pelo `recebido_em` (não pelo timestamp medido): ONLINE
  = leitura recebida há ≤ 30 s; após queda de rede o firmware reenvia leituras
  antigas e o que importa é que voltou a chegar dado.
- **Alerta:** função pura `DetectorFluxoContinuo` + cálculo sob demanda (sem
  tabela); uma consulta barata descarta os sensores com pausa recente, então a
  lista não paga o custo de carregar leituras de todos.
- **App:** Expo SDK 57, NativeWind 4.2.7 (spike aprovado: renderiza na Web),
  `react-native-gifted-charts`, TanStack Query com polling (5 s no sensor, 10 s
  nas listas), Zustand só para a sessão, `Stack.Protected` para a guarda de
  rotas. Node 22 (o RN 0.86/Metro exige ≥ 22.13; o padrão da máquina é o 20 —
  já havia 22.x no nvm).
- **Simulador em Python (stdlib):** payload idêntico ao do firmware; perfis
  normal/ocioso/vazamento; histórico com janelas de 60 s (aproximação
  documentada).

## Bugs reais encontrados (relevante para a redação)

Todos apareceram ao **rodar** (curl, e2e em navegador ou comparação com a API):

1. **`403` para token expirado (backend).** O `JwtAuthFilter` engole token
   inválido e, sem `AuthenticationEntryPoint`, o Spring devolvia 403 — o mesmo
   status de "sem permissão". O app não conseguiria distinguir "sessão expirou"
   de "proibido". Corrigido: não autenticado = 401.
2. **"Dia" em UTC (backend).** No container a sessão do banco é UTC, então o
   dia virava às 21h de Criciúma. Corrigido com o fuso explícito; coberto por
   teste (leitura às 01:00Z cai no dia anterior).
3. **Primeiro dia parcial nos gráficos** de 7/30 dias → início alinhado.
4. **Simulador morria ao reiniciar o backend:** `ConnectionResetError` (uma
   `OSError`) não era tratada, e o log ficava vazio porque o Python faz buffer
   de stdout redirecionado. Corrigido (trata `OSError`; saída line-buffered) e
   verificado derrubando o backend de propósito.
5. **NativeWind na Web:** erro de JavaScript na página ao iniciar ("Cannot
   manually set color scheme, as dark mode is type 'media'") — bug do runtime
   web do `react-native-css-interop`. Contornado com `darkMode: 'class'` e
   `userInterfaceStyle: light`.
6. **Cartão-resumo ilegível:** `bg-white` (base) e `bg-sky-800` (override)
   coexistem no CSS gerado e o branco vencia, deixando o total invisível.
   Achado no screenshot; virou uma variante explícita (`destaque`).
7. **Rótulo defasado ao trocar de período:** mostrava "Total (7 dias)" com o
   número das 24 h (883 L × 1.831 L na API). Causa: `keepPreviousData` +
   rótulo vindo do seletor. Achado pelo e2e que compara a tela com a API usando
   **os mesmos parâmetros** da requisição; corrigido fazendo o dado carregar o
   próprio período.
8. **Rótulos do eixo X do gráfico de vazão quebrados** (só "2", "2"): o
   contêiner do rótulo tem a largura de cada ponto (~3 px). Ajustado.
9. **Ferramental:** um dev server Metro antigo (modo CI, sem watch) ficou
   escutando e foi reaproveitado, servindo código de antes das edições — horas
   de "bug fantasma". `e2e/run.sh` agora se recusa a reaproveitar servidor
   existente. Também: no Node 22 `node --test dir/` não varre diretórios; o
   TypeScript 6 não carrega `@types/*` sozinho e exige declaração para
   `import '*.css'`.

## Verificação real (o que foi de fato executado)

- **Backend:** `mvn test` → **42/42** (Testcontainers, TimescaleDB real):
  painel/autorização/fuso/CORS/alinhamento, detector de vazamento (9, sem
  banco) e integração de alertas (5).
- **App:** `tsc --noEmit` limpo; Jest **33/33**; `expo export --platform web`
  OK; **e2e 32/32** em Chromium headless (login e sessão, visão por papel,
  gráficos conferidos contra a API, **polling comprovado** — uma leitura
  injetada aparece na tela sem recarregar —, 401 no meio do uso, falha de rede
  com "tentar novamente", sensor offline, links diretos, permissão 403, alertas).
- **Alerta ponta a ponta real:** backend com limite de 2 min + simulador em
  perfil vazamento → só o apto 103 foi sinalizado (101 e 102 não), na API e na
  tela. Depois o backend voltou ao padrão de 30 min.
- **Simulador:** provisionamento idempotente; 48 h de histórico (8.640 POSTs em
  87 s); modo contínuo sobrevive a queda do backend e retoma.
- Screenshots em `docs/screenshots/` (dados simulados).

## Pendente

- [ ] **Testes com o ESP32 (NÃO realizados):** Sprint 3 Etapa B, calibração da
  Sprint 1 e, com eles, o critério da Sprint 4 ("dados reais no gráfico").
- [ ] **Celular (Expo Go):** `EXPO_PUBLIC_API_URL=http://<IP-do-PC>:8080` e
  portas 8080/8081 liberadas no `firewalld`. Só a Web foi testada.
- [ ] `npm run web` em modo watch (o e2e usa modo CI; o limite de inotify do
  Linux não foi exercitado).
- [ ] Instrumentação de `t_exibido` no app (métrica de latência da Sprint 6):
  hoje o app exibe `timestampLeitura`, `recebidoEm` e o atraso medida→servidor.
- [ ] Ajustar a regra de vazamento com dados de bancada (o YF-S201 mede mal
  vazão muito baixa; gotejamento lento pode não acionar).
- [ ] Simulador multi-apartamento formal, queda de rede e reinício (Sprint 5).
- [ ] Deploy do bundle web e HTTPS (Sprint 7).

## Estado atual do repositório

```
CLAUDE.md          Sprint 4 marcada 🟡; stack do app, regras e riscos atualizados
docker-compose.yml + APP_ALERTA_FLUXO_CONTINUO_MINUTOS (padrão 30)
firmware/          sem mudanças nesta etapa (Sprint 3 código pronto, sem hardware)
backend/           + endpoints do app, CORS, fuso, 401, alertas, sensor.simulado (V8) — 42 testes
app/               NOVO: Expo (Web + Mobile), 4 telas, 33 testes Jest, 32 e2e
docs/              stack-10-09.md, stack-25-09.md, scripts/simulador.py, screenshots/
```

A stack Docker ficou no ar (tcc-db, tcc-backend, tcc-pgadmin) com dados
**simulados** no banco de desenvolvimento (condomínio "Condomínio Simulado
(TCC)", 3 apartamentos, ~48 h de histórico); o simulador está **parado**. Para
recomeçar do zero: `docker compose down -v`.

## Observações para a redação do TCC

- **Real × simulado:** nada do que o app mostra hoje é medição real. A coluna
  `sensor.simulado`, o selo no app e o script documentado permitem separar os
  dois na análise; a redação precisa dizer isso explicitamente.
- **Validação por comparação:** o e2e confere o que aparece na tela com o que
  a API devolve para os mesmos parâmetros — foi assim que o bug do rótulo
  defasado apareceu. Bom exemplo de "validar rodando", como na Sprint 2.
- **Alerta = diferencial do trabalho:** a regra é simples e explicável
  (fluxo contínuo ≥ 30 min) e a limitação do YF-S201 em baixa vazão é um
  achado a discutir; o limite deve ser calibrado na Sprint 6.
- **Tempo real por polling** (5–10 s) atende ao objetivo; a latência que o
  usuário percebe soma o envio (5 s de janela) e o polling — a decompor na
  Sprint 6 (`t_captura`, `t_persistido`, `t_exibido`).

