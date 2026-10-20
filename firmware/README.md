# firmware

Projeto PlatformIO para o ESP32: lê os pulsos do sensor de fluxo YF-S201
(efeito Hall) via `attachInterrupt()`, calcula a vazão (f ≈ 7.5 × Q L/min, com
constante calibrada por sensor) e envia as leituras via `POST /api/leituras`
para o backend.

**Stack:** PlatformIO, `WiFi.h` + `WiFiManager`, ArduinoJson, `HTTPClient.h`,
NTP (`configTime()`), `Preferences` (NVS). Versões fixadas em
`platformio.ini` (`espressif32@7.1.2`, `WiFiManager@2.0.17`,
`ArduinoJson@7.4.3`).

**Sprint:** Sprint 3 implementado — Wi-Fi via portal cativo, NTP, envio
periódico com fila e reenvio. Código pronto e validado **sem hardware**
(compilação, testes no host e contrato HTTP por curl). **Os testes com o ESP32
físico (Etapa B) NÃO foram realizados** — o dispositivo não estava com o
desenvolvedor em 25/09/2026 — e seguem pendentes, assim como o upload e a
calibração da Sprint 1. Ver seção 5 do `CLAUDE.md` na raiz do repositório.

## Como funciona

```
ISR (contagem de pulsos, sempre ativa)
   └─ amostra a cada 1 s → Serial (vazão, volume, estado da fila/Wi-Fi/hora)
         └─ soma na janela de 5 s → fecha com hora NTP válida → Leitura (delta) → fila (200)
                                                                       └─ 1 POST por iteração, em ordem
```

- **Cada leitura é o delta da janela** (`pulsos` e `volumeMlEstimado` só da
  janela de 5 s), nunca o acumulado. O `volume_total` impresso no Serial é só
  para calibração e **nunca é enviado** (o backend soma os volumes).
- `timestampLeitura` = fim da janela, UTC com milissegundos e `Z`.
- Sempre há um POST por janela, inclusive com 0 pulsos (heartbeat).
- `sequencia` incrementa a cada leitura enfileirada e **zera quando o ESP32
  reinicia**; a fila em RAM também se perde no reinício.
- Sem NTP sincronizado a janela não fecha (os pulsos continuam acumulando).

### Política por status HTTP

| Resposta | Ação |
|---|---|
| `2xx`, `409` | sucesso — remove da fila (`409` = o backend já tem a leitura) |
| `400` | payload rejeitado — descarta e loga (retry não resolve) |
| `401` | token/`sensorId` errado — loga alto e só tenta de novo em 60 s |
| timeout, sem rede, `5xx`, outros | mantém na fila; recuo 5 → 10 → 20 → 40 → 60 s |

Fila cheia (200 ≈ 16 min): descarta a leitura mais antiga e conta em
`droppedCount`.

## Estrutura

```
include/config.h         pinos, calibração padrão, janelas, timeouts, NTP, portal
lib/FlowMeter/           pulsos -> vazão/volume (puro, testável no host)
lib/LeituraPayload/      JSON do POST + timestamp ISO-8601 (puro, testável no host)
lib/SendQueue/           fila circular + política de status/backoff (puro, testável no host)
src/DeviceConfig.*       config por dispositivo na NVS (URL, sensorId, token, pulsos/litro)
src/Network.*            WiFiManager (portal), NTP, POST HTTP/HTTPS, botão BOOT
src/main.cpp             ISR + janelas + fila + reenvio
test/                    testes Unity das libs (rodam no host, sem hardware)
```

Padrão do projeto: **lógica pura em `lib/` (testada no host), hardware em
`src/`**.

## Compilar e testar (sem hardware)

```bash
pio test -e native        # 23 testes: FlowMeter, LeituraPayload, SendQueue
pio run -e esp32dev       # compila para o ESP32 (sem upload)
```

## Com o ESP32 conectado

```bash
pio run -e esp32dev -t upload      # exige estar no grupo `dialout`
pio device monitor -b 115200
```

### Configuração inicial (portal cativo)

1. Crie apartamento e sensor pela API (`POST /api/sensores`); guarde o `id`
   (= `sensorId`) e o `token` — o token só é exibido nessa resposta.
2. Na primeira execução (sem Wi-Fi salvo) o ESP32 abre a rede
   **`TCC-Sensor-Setup`**. Conecte pelo celular/PC; o portal abre sozinho
   (ou `192.168.4.1`) e pede: rede Wi-Fi 2,4 GHz, URL da API
   (`http://<IP-do-PC>:8080`), `sensorId`, token e pulsos/litro.
3. Tudo é salvo na NVS: o ESP32 reconecta sozinho nos próximos boots.
4. **Reconfigurar:** segure o botão **BOOT (GPIO0) por 3 s com o firmware
   rodando** — apaga o Wi-Fi salvo e reinicia no portal (os demais campos vêm
   pré-preenchidos). Não segure BOOT durante o reset: isso entra no modo de
   download do ESP32.
5. O portal expira em 180 s; depois disso o firmware segue offline (medindo e
   enfileirando) e tenta reconectar a cada 30 s.

O backend precisa estar acessível da LAN: `docker compose up -d` na raiz e
porta liberada no `firewalld` do PC (`sudo firewall-cmd --add-port=8080/tcp`).

### Calibração (pendente — Sprint 1)

Escoe um volume conhecido (proveta + cronômetro) e anote o `pulsos_total` do
Serial **antes e depois** do ensaio: a diferença são os pulsos do ensaio,
independentes do K gravado na NVS (o `volume_total` já vem convertido pelo K
atual). Recalcule `pulsos_por_litro = pulsos_contados / litros_reais` — na
Sprint 6, com `docs/scripts/analise/calibracao.py` (Equação 2 do artigo).
Grave o novo valor pelo portal (campo *Pulsos por litro*); não é preciso
recompilar. `PULSES_PER_LITER` em `config.h` é só o valor padrão (datasheet).

Para a taxa de entrega, cada leitura emitida aparece no Serial como
`[FILA] seq=N enfileirada` (enviada ou não) — a primeira e a última dão o
N_esp da Equação 4, por boot (a `sequencia` zera quando o ESP32 reinicia).

### Antes de ligar o sensor

O YF-S201 costuma ser alimentado em 5 V. Meça com multímetro que o nível alto
do sinal **não passa de 3,3 V** antes de ligá-lo ao GPIO27 (se passar, use
divisor de tensão).

## Transporte

HTTP puro na LAN nesta sprint (o `X-Sensor-Token` trafega em claro — aceitável
em bancada). Se a URL for `https://`, usa `WiFiClientSecure` com
`setInsecure()` (sem validar certificado); a validação da cadeia fica para o
deploy de demonstração (Sprint 7).
