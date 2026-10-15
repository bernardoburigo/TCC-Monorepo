# Avanço do sistema — 15/10/2026

> Registro de desenvolvimento do dia. Ver seção "Convenções para o Claude
> Code" do `CLAUDE.md` para o propósito destes arquivos `stack-DD-MM.md`.
> Continua de `docs/stack-09-10.md` (Sprint 3 ainda 🟡, bloqueada por
> hardware).

## Resumo do dia

**O ESP32 + YF-S201 chegaram.** Maior marco do projeto até agora: o
firmware foi gravado no hardware físico pela primeira vez, a fiação do
sensor foi validada, e — pela primeira vez — uma leitura **real** (não
simulada) percorreu o caminho completo: sensor → ISR → janela de 5 s →
POST HTTP → backend → banco → consulta de consumo, com os números batendo
exatamente entre o Serial do ESP32 e o banco. Isso resolve o maior risco
do cronograma reestruturado em 09/10 (dependência do hardware) e fecha, na
prática, o critério de validação da Sprint 3 ("ponta a ponta: abrir a
torneira → ver registro no banco em segundos" — testado com spray em vez
de torneira, mesmo mecanismo).

## 1. Revisão da fiação antes de ligar

O orientando conectou: vermelho (VCC) → 3,3V, preto (GND) → GND, amarelo
(sinal) → **D15**. Revisão do firmware antes de dar aval:

- `firmware/include/config.h:12` fixa `SENSOR_PULSE_PIN = 27`, com
  comentário explícito: "GPIO27 é interrupt-capable e não é um pino de
  bootstrapping". D15 = GPIO15, que É um pino de bootstrapping (MTDO) —
  o próprio código já evitava esse pino de propósito. **Corrigido: fio
  amarelo movido para GPIO27**, sem alterar código.
- `firmware/src/main.cpp:128-130` usa `pinMode(..., INPUT_PULLUP)` +
  `attachInterrupt(..., FALLING)`: o nível alto do sinal é definido pelo
  **pull-up interno do ESP32 (3,3V)**, não pela alimentação do sensor — o
  YF-S201 só precisa puxar a linha para baixo (saída coletor aberto). Por
  isso alimentar em 3,3V (em vez dos 5V assumidos no `firmware/README.md`)
  é seguro para o GPIO independentemente do tipo de saída do sensor,
  eliminando a necessidade do divisor de tensão cogitado ali. O risco
  remanescente era outro: datasheets do YF-S201 costumam especificar
  5–18V como faixa de operação, abaixo da qual o sensor pode não gerar
  pulsos de forma confiável — **testado e funcionou** (ver seção 3).

## 2. Upload: dois bugs de ambiente (não do projeto)

1. **Grupo `dialout` não é editável neste sistema.** `sudo usermod -aG
   dialout $USER` reportou sucesso mas não teve efeito —
   `getent group dialout` resolve a GID 18, mas `/etc/group` não tem
   nenhuma linha `dialout` (o grupo parece sintetizado pelo systemd nesta
   distro/imagem atômica, não editável pelo caminho tradicional).
   Corrigido com uma regra **udev** permanente, baseada no
   VID:PID do chip USB-serial (`1a86:55d4`, um WCH CH343), em
   `/etc/udev/rules.d/99-esp32-usb-serial.rules`, `MODE="0666"` —
   funciona imediatamente e sobrevive a replugs/reboots, sem depender do
   grupo quebrado.
2. **`pio device monitor` não roda sem terminal interativo** (erro
   explícito: "requires an interactive terminal on stdin"). Tentei ler a
   porta direto com `pyserial` em background — veio lixo binário, porque
   abrir a porta sem tratar DTR/RTS explicitamente deixa o ESP32 preso em
   reset/bootloader (o `pio device monitor` cuida disso por baixo dos
   panos). **Resolvido deixando o próprio orientando rodar
   `pio device monitor` no terminal dele** — mais rápido e permite ver os
   giros do sensor ao vivo enquanto mexe no hardware.

## 3. Primeiro teste: pulsos confirmados

Upload com sucesso (`pio run -e esp32dev -t upload`, 30 s, chip
identificado como **ESP32-D0WD-V3**, Flash 80,3%/RAM 16,6% — mesmos
números do Sprint 3 sem hardware). No monitor serial, o orientando
borrifou água no sensor duas vezes; o Serial mostrou exatamente o padrão
esperado de um pulso de vazão (subida rápida, decaimento suave até zero):
picos de até 419 pulsos numa janela de 1 s (≈ 55,9 L/min), caindo a 0 em
~10 s. **Fiação e alimentação em 3,3V confirmadas funcionais** — não foi
preciso mudar para 5V.

Detalhe que gerou confusão inicial: o Serial ficou **sem imprimir nada por
~180 s** logo após o boot. Causa: `Network::begin()` chama
`WiFiManager::autoConnect()`, que é **bloqueante** até conectar ou até o
`PORTAL_TIMEOUT_S` (180 s, `config.h`) expirar — `loop()` (onde o Serial
de vazão é impresso) só começa a rodar depois disso. Não é um bug: o log
mostrou a placa tentando uma rede salva "Yan-J5" (resquício de um flash
anterior, antes deste projeto) por ~20 s, abrindo o portal
`TCC-Sensor-Setup`, e só então expirando e caindo no loop normal.

## 4. Integração real com o backend

Criado, via API (reaproveitando o síndico simulado existente), um
apartamento **separado dos simulados** para o hardware real:

| Campo | Valor |
|---|---|
| Apartamento | 201 (mesmo condomínio "Condomínio Simulado (TCC)", mas isolado dos 101/102/103) |
| Sensor | `ESP32-REAL-201`, `simulado=false` → selo **REAL** no app |
| `sensorId` | `1452fd40-9044-4c85-8fb5-5cce29488798` |

Processo de configuração do ESP32:
1. Segurar BOOT (GPIO0) por 3 s **com o firmware já rodando** — apaga o
   Wi-Fi salvo ("Yan-J5") e reinicia direto no portal (sem os 20 s de
   tentativa inútil).
2. Portal preenchido: Wi-Fi real ("Quarto 402"), URL da API
   (`http://192.168.10.10:8080` — IP da máquina de desenvolvimento, mudou
   por DHCP desde a última sessão), `sensorId`/token acima, pulsos/litro
   deixado no valor teórico (450 — calibração formal fica para depois).

Resultado: Wi-Fi conectado, NTP sincronizado, fila drenando (`[POST]
seq=N -> 201`). A primeira tentativa de envio falhou (-1, antes do NTP
terminar de sincronizar) e foi **retida e reenviada com sucesso** pela
fila — o mecanismo de retry/backoff funcionando organicamente, não só em
teste. Confirmado no backend via `curl`:

- `GET /api/sensores/{id}/status` → `simulado: false`, `status: ONLINE`.
- `GET /api/sensores/{id}/leituras` → 17 leituras persistidas, pulsos e
  volumes batendo com o que apareceu no Serial.
- `GET /api/apartamentos/{id}/consumo` → **9062,22 mL**, idêntico ao
  `volume_total` acumulado no Serial do ESP32 até aquele momento.

Latência leitura→banco (`recebido_em − timestamp_leitura`) observada
≈ 0,5–1 s nas leituras com fluxo, bem dentro do esperado.

## Pendente

- [ ] **Calibração quantitativa** (proveta + cronômetro): hoje o sensor
  ainda usa o K teórico (450 pulsos/L); falta comparar com volume
  conhecido e ajustar via portal (sem recompilar).
- [ ] **Teste de queda de rede** proposital (desligar Wi-Fi e,
  separadamente, o backend) — verificar fila, backoff e continuidade de
  `sequencia` ao voltar.
- [ ] Conferir **visualmente no app** (Web e/ou celular) que o apartamento
  201/sensor `ESP32-REAL-201` aparece corretamente, com o selo REAL e o
  gráfico atualizando por polling — só validado via API nesta sessão.
- [ ] Reiniciar o ESP32 propositalmente e confirmar que `sequencia` volta
  a 0 sem quebrar a constraint de unicidade (comportamento já previsto no
  design, não testado na prática ainda).

## Estado atual do repositório

```
CLAUDE.md            Sprints 1, 3, 4 atualizadas com o resultado de hoje; risco do ESP32 removido
docs/progresso.md     checklist atualizado (upload e ponta a ponta marcados)
docs/stack-15-10.md   este arquivo
/etc/udev/rules.d/99-esp32-usb-serial.rules   NOVO (fora do repo) — acesso permanente ao ESP32 por USB
firmware/, backend/, app/   sem mudanças de código nesta sessão (só configuração do dispositivo via portal)
```

O ESP32 ficou configurado e potencialmente ainda conectado/enviando dados
reais para o apartamento 201 do banco de desenvolvimento ao final da
sessão (dependendo de o orientando ter deixado a placa ligada).

## Observações para a redação do TCC

- O episódio do grupo `dialout` "fantasma" (existe via `getent`, não
  existe em `/etc/group`) é uma boa nota de rodapé sobre peculiaridades de
  distros atômicas/imutáveis — resolvido com udev em vez do caminho
  tradicional, sem impacto no projeto em si (ambiental, como o bug do
  Docker do dia 09/10).
- A escolha de alimentar o YF-S201 em 3,3V em vez dos 5V assumidos
  originalmente é uma decisão técnica defensável e documentável: o
  firmware já usa pull-up interno + borda de descida, então o nível alto
  do sinal nunca depende da alimentação do sensor — simplifica a fiação
  (sem divisor de tensão) à custa de operar abaixo da faixa nominal do
  datasheet. Funcionou nos testes qualitativos; vale registrar como
  decisão de projeto na redação, com a ressalva de reavaliar se a Sprint 6
  (calibração formal) mostrar comportamento inconsistente.
- O bloqueio de 180 s no boot (portal do WiFiManager) é comportamento
  **esperado e documentado** (`PORTAL_TIMEOUT_S`), não um defeito — mas é
  fácil de interpretar como travamento na primeira vez que se vê. Vale uma
  frase na redação sobre esse tempo de inicialização em cenários sem rede
  salva.
- A fila reagindo sozinha a uma falha real de rede (NTP ainda não pronto)
  é uma evidência orgânica, não forçada, de que o mecanismo de
  retry/backoff da Sprint 3 funciona — bom material para a seção de
  resultados sobre confiabilidade de transmissão.

---

# Planejamento do deploy público (mesmo dia, 15/10)

## Resumo

Com o pipeline ponta a ponta validado na LAN, o passo seguinte é tirar o
sistema de "só funciona na rede de casa". Decisão tomada com o orientando:
backend + banco continuam no servidor caseiro dele (ThinkCentre, 8 GB RAM,
Ubuntu Server, hoje sem nenhuma configuração), expostos via **Cloudflare
Tunnel** com domínio próprio; o app Web vai pra **Vercel** (build estático
do Expo); os dois sob o mesmo domínio, por subdomínio
(`api.SEUDOMINIO.com` / `app.SEUDOMINIO.com`).

**Decisão de processo:** o orientando vai instalar o Claude Code direto no
servidor e seguir o plano por lá — esta sessão (rodando na máquina de
desenvolvimento) não tem acesso ao servidor. Por isso o produto principal
desta etapa não é execução, é um **plano autocontido**
(`docs/deploy-servidor.md`) detalhado o bastante pra uma sessão sem
nenhum contexto desta conversa conseguir seguir.

## Validação do plano antes de escrever

Antes de fechar o plano, rodei uma validação dedicada (subagente Plan) com
foco só na parte de infraestrutura (Cloudflare Tunnel + systemd, Vercel +
Expo Router em monorepo, DNS compartilhado Cloudflare/Vercel, hardening
Ubuntu, rotação de segredos) — encontrou problemas concretos que não
estavam no desenho inicial:

- **`.gitignore` da raiz não ignorava nenhum `.env`** — teria sido fácil
  commitar segredos reais do servidor sem perceber.
- **`app.json` gera SPA puro** (`web.output: "single"`) — sem rewrite na
  Vercel, qualquer rota profunda dá 404 num refresh.
- **`app/.nvmrc` fixa Node 22, mas a Vercel não garante ler isso** pra todo
  framework — build podia falhar ou rodar com Node errado em silêncio.
- **`/etc/cloudflared/` vs `~/.cloudflared/`:** o serviço systemd do
  `cloudflared` roda com outro usuário/HOME e não enxerga o
  credentials-file gerado pelo `tunnel login`/`create` do usuário normal —
  causa clássica de "sobe mas dá permission denied", só aparece documentada
  se alguém já passou por isso.
- **Docker ignora regras do `ufw`** em portas publicadas (`-p`) — o
  `docker-compose.yml` publicava `db`/`pgadmin`/`backend` em todas as
  interfaces; um `ufw` genérico não bloquearia isso de verdade. A
  mitigação real é bind em `127.0.0.1`.
- **`show-details=always`** no Actuator (achado direto no
  `application.properties`) vazaria detalhes de banco/disco publicamente,
  já que `/actuator/**` é `permitAll()`.

## Entregue

- `.gitignore` (raiz): ignora `.env`.
- `docker-compose.yml`: segredos trocados de valores fixos para
  `${VAR:-valor-de-dev}` — continua funcionando sem `.env` local, mas
  fica sobrescrevível por um `.env` real no servidor.
- `docker-compose.yml`: portas de `db`/`backend`/`pgadmin` agora usam
  `${BIND_HOST:-0.0.0.0}:...` — em dev continua igual (padrão `0.0.0.0`);
  no servidor, `BIND_HOST=127.0.0.1` no `.env` restringe tudo a localhost.
  (Tentei primeiro um `docker-compose.prod.yml` com override de `ports:`,
  mas o merge de múltiplos arquivos do Compose **concatena** listas em vez
  de substituir — teria publicado a porta duas vezes, em `0.0.0.0` **e**
  `127.0.0.1` simultaneamente, derrotando o propósito. Confirmado com
  `docker compose config --format json` antes de seguir.)
- `app/vercel.json` (novo): rewrite de SPA.
- `app/package.json`: `engines.node = "22.x"`.
- `backend/.../application.properties`: `show-details` de `always` para
  `when-authorized`.
- `docs/deploy-servidor.md` (novo): guia completo — arquitetura, ações
  manuais (domínio, Cloudflare, Vercel) e passo a passo no servidor
  (hardening, Docker, segredos, Tunnel, reconfiguração do ESP32),
  verificação ponta a ponta e riscos aceitos.
- `CLAUDE.md` §3 (DevOps): decisão registrada, link pro guia novo.

## Pendente

- [ ] Nada disso foi executado ainda — depende do orientando comprar o
  domínio, criar as contas Cloudflare/Vercel e instalar o Claude Code no
  servidor.
- [ ] Confirmar se o repositório no GitHub é público ou privado (afeta o
  `git clone` no servidor).

## Observações para a redação do TCC

- A divisão "sessão de dev planeja, sessão no servidor executa" é, em si,
  um padrão de trabalho que vale descrever na metodologia: o plano vira um
  artefato versionado (`docs/deploy-servidor.md`) em vez de conhecimento
  tácito de quem rodou os comandos.
- Os achados da validação do plano (permissão do cloudflared, `ufw` x
  Docker, `.gitignore` sem `.env`) são bugs de infraestrutura pegos **antes**
  de acontecer em produção — mesmo espírito dos bugs reais de código já
  registrados em sessões anteriores (ex.: `403` enganoso, `LazyInitializationException`),
  só que na camada de deploy.
