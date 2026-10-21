# Avanço do sistema — 21/10/2026

> Registro de desenvolvimento do dia. Ver seção "Convenções para o Claude
> Code" do `CLAUDE.md` para o propósito destes arquivos `stack-DD-MM.md`.
> Continua de `docs/stack-20-10.md`.

## 1. Simulador em produção (Etapa 1)

No servidor (SSH, após `git pull`): `provisionar --sindico-email` com
`--api http://127.0.0.1:8080` (sem passar pelo túnel) criou os aptos
101–103, com sensores simulados e o proprietário simulado, no "Condomínio TCC",
ao lado do apto 201 (sensor real). Em seguida, `historico --horas 48`.

## 2. Registro do teste de alerta no `rodar`

Antes, o `rodar` só imprimia `[HH:MM:SS]` no terminal: sem data, sem arquivo e
sem o T0 do vazamento. Para o "X s após o limite" do §3.1 ficar documentado:

- `--log ARQUIVO`: cada linha com data/hora UTC (mesmo padrão do
  `serial_log.py`), mais o `timestampLeitura` de cada leitura.
- Eventos dos aptos com perfil `vazamento`: T0 (1ª leitura da execução — o
  perfil tem fluxo em todas as janelas), o horário do limite (T0 + 30 min,
  também em hora de Criciúma) e a leitura que o completa.
- `--vigiar-alertas`: depois do limite, consulta `/alertas` do apto a cada
  volta e registra quando o alerta aparece na API (login do síndico; senha por
  `TCC_SINDICO_SENHA` ou terminal; renova o JWT em 401). Separa a detecção no
  backend da exibição no app, que vem no polling seguinte (≤ 5 s na tela do
  apartamento).
- `--limite-alerta` (padrão 30) espelha `app.alerta.fluxoContinuoMinutos`.

**Verificação:** backend local recriado com
`APP_ALERTA_FLUXO_CONTINUO_MINUTOS=1`, `rodar --perfil 103=vazamento --log
--limite-alerta 1 --vigiar-alertas` por 95 s: T0 às 10:53:19.653Z, limite
atingido às 10:54:19.654Z e alerta visível na API **0,1 s** depois. Backend
local devolvido aos 30 min. Ressalva: reiniciar o `rodar` com menos de 15 s de
intervalo emenda o fluxo anterior no backend e deixa o T0 registrado tardio.

## 3. App: "rodou com dados mock" e o build do APK

`npm run web` sem `.env` na `app/` parecia usar dados mock. Investigado: não
há `.env*` na pasta, nem `EXPO_PUBLIC_*` no shell ou nos scripts do
`package.json`; reproduzindo o `expo start` nas mesmas condições, o env
virtual do Expo só define `EXPO_PUBLIC_PROJECT_ROOT` — o mock fica
**desligado** e a API cai no padrão `http://localhost:8080`, o **backend local
do Docker**, cujos dados vêm do simulador. Daí a impressão de "mock". (O mock
de verdade só aceita as contas `*.mock@tcc.com`.)

O risco real estava no APK: o EAS Build não recebe o `.env.local` (ignorado
pelo git), então o build sairia apontando para `localhost:8080`. Criado
`app/eas.json` com o perfil `apk` (`buildType: apk`, distribuição interna) que
fixa `EXPO_PUBLIC_API_URL=https://apitcc.bernardoburigo.com.br`,
`EXPO_PUBLIC_USE_MOCK_DATA=false` e `EXPO_PUBLIC_REGISTRAR_LATENCIA=false`, e
`android.package = br.unesc.tcc.telemetria` no `app.json` (exigido pelo
build). **Verificação:** `expo export --platform android --no-bytecode` com
essas variáveis — o bundle de produção contém a URL pública, não contém
`localhost:8080`, e o `MOCK_ATIVO` foi compilado como constante `false`.
Passo a passo em `app/README.md`, "APK nativo (EAS Build)".
