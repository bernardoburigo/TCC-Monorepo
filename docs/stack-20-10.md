# Avanço do sistema — 20/10/2026

> Registro de desenvolvimento do dia. Ver seção "Convenções para o Claude
> Code" do `CLAUDE.md` para o propósito destes arquivos `stack-DD-MM.md`.
> Continua de `docs/stack-19-10.md`.

## Resumo do dia

As correções da validação de paridade de 19/10 foram aplicadas no Overleaf
(PDF novo em `docs/`), a tensão do sensor foi decidida (**3,3 V da placa**,
justificada no §2.2) e a medição de latência foi commitada (`6a15c1b`).
Conferido o PDF novo contra o repositório: não restam divergências; o que
está em vermelho é só dado prático, mais o critério de aceitação de L_tot,
que precisa ser fixado antes dos ensaios. Definido o roteiro até a entrega
(`docs/progresso.md`, "Roteiro até a entrega").

## 1. O que o texto novo passou a pressupor

O artigo agora descreve o sistema publicado, e isso criou três pendências
práticas:

- **ESP32 → HTTPS → Cloudflare** (Figura 1, §2.1): o ESP32 ainda aponta
  para a LAN; reconfigurar pelo portal na Etapa 0.
- **Painel com o sensor real ao lado dos virtuais** (§3.1): o simulador
  sempre criava o próprio síndico e condomínio, então os aptos virtuais nunca
  apareciam no painel do apto 201. Resolvido hoje (seção 2).
- **Latência pelo app em produção:** o CORS de produção só libera
  `https://tcc.bernardoburigo.com.br`, então o `npm run web` local não
  consegue falar com a API pública. Decisão: ligar
  `EXPO_PUBLIC_REGISTRAR_LATENCIA=true` na Vercel durante a coleta (mede pelo
  caminho real descrito no artigo) e desligar depois.

## 2. Simulador no condomínio de um síndico existente

`docs/scripts/simulador.py provisionar --sindico-email <email>`: usa o
síndico informado (não registra o síndico simulado) e cria os aptos
101–103, os sensores virtuais e o proprietário simulado no condomínio dele.

- A senha vem de `TCC_SINDICO_SENHA` ou é pedida no terminal (`getpass`) —
  não há `--sindico-senha` para a senha real não ficar no histórico do
  shell — e **não é gravada** no arquivo de estado.
- Para produção, usar `--estado docs/scripts/.simulador-estado-prod.json`
  (o padrão continua sendo o estado local usado pelos e2e). O `.gitignore`
  passou a cobrir `.simulador-estado*.json`.
- Com o síndico com mais de um condomínio, usa o primeiro e avisa.
- **Armadilha encontrada no teste:** se o proprietário simulado já existe
  (409), o registro não o revincula; ele continua com os apartamentos de
  quando foi criado. A mensagem antiga dizia "só o apartamento 101", o que
  era falso nesse caso — agora avisa para conferir em `/api/me/apartamentos`.
  Em produção a conta ainda não existe, então será criada no 101 certo.

**Verificação (backend local):** síndico de teste com apto 201 →
`provisionar --sindico-email` → `/api/me/apartamentos` do síndico =
`['101', '102', '103', '201']`; estado salvo sem senha; proprietário e
síndico de outro condomínio recebem **403** no consumo do 101 novo; `rodar`
com o estado separado envia com `201`. Ficaram no banco **local** o síndico
`sindico.teste-real@tcc.com` e o "Condominio Teste Real" (só dev).

## 3. Roteiro da bancada

Nova seção "Dia de ensaio" em `docs/scripts/analise/README.md`: preparação
(Serial em `tee`, purga, marcas do registro), passo a passo de cada ensaio,
como registrar refazimentos (linha comentada com `#`), ordem das campanhas,
gravação do K no portal (o BOOT apaga o Wi-Fi salvo; anotar data e hora da
troca) e a sessão conjunta de comunicação + latência.

## 4. Firmware novo no ESP32 e início dos testes de comunicação

À noite, com o ESP32 no PC de casa (`/dev/ttyACM0`). A placa ainda rodava o
firmware de 16/10 (sem `pulsos_total`), já com a URL HTTPS de produção na
NVS — o HTTPS via Cloudflare já tinha sido validado no site em produção.
Gravado o firmware de 19/10 (`pio run -t upload`): o upload escreve em
0x8000/0xe000/0x10000 e **não toca a NVS** (0x9000), então Wi-Fi, URL,
sensorId e token continuaram. Serial confirmado: `pulsos_total`,
`[FILA] seq=N enfileirada` e `POST -> 201` pela API pública.

Ferramentas novas em `docs/scripts/analise/`:

- `serial_log.py`: grava o Serial com a hora do PC (UTC) em cada linha. O
  `pio device monitor` exige terminal interativo e não roda em segundo plano.
- `exportar_leituras.py`: exporta as leituras de um sensor pela API
  (`/api/sensores/{id}/leituras`, máximo 240 min) no CSV do `entrega.py`,
  sem precisar entrar no banco do servidor.

**Achados reais:**

- **Abrir a porta serial reinicia o ESP32**, mesmo com DTR/RTS desligados no
  pyserial (o Linux ativa as linhas ao abrir o dispositivo). Consequência
  boa: cada log de condição cobre exatamente um boot (`sequencia` a partir
  de 0). O `entrega.py` passou a deduzir o recorte do banco das horas do
  próprio log, deixando de fora o boot anterior e o que começa quando a porta
  fecha.
- **Linhas do boot anterior chegam antes do banner** (estavam no buffer da
  serial): o primeiro log começou com `seq=30` do boot velho. O `entrega.py`
  agora descarta tudo antes do banner `firmware YF-S201` e começa a janela na
  primeira leitura enfileirada.
- Na primeira tentativa com pyserial e DTR/RTS padrão, a placa ficou presa
  em reset (nenhuma saída); com os dois desligados antes de abrir, ela sobe.

Iniciada às 00:31 UTC (21:31 em Criciúma) a **condição "rede estável"**: 60
min de log em `docs/resultados/serial-rede-estavel.log`, sem água (o ESP32
envia uma leitura a cada 5 s mesmo com 0 pulsos).

**Cancelada após ~11 min:** havia um download de 43 GB em outra máquina da
mesma rede. Ele satura a descida, por onde passam tanto o POST do ESP32 (que
volta da Cloudflare até o servidor pelo túnel) quanto o polling do app — a
condição deixa de ser "rede estável". O log ficou guardado como
`docs/resultados/exploratorio-rede-com-download-20-10.log` (129 leituras
emitidas, todos os POSTs com `201`), **fora** da análise do artigo. Refazer
com a rede sem tráfego pesado.

## 5. Figuras do artigo

- **Figura 1 (arquitetura)** em TikZ: `docs/figuras/figura1-arquitetura.tex`
  (para `\input` no Overleaf, com o preâmbulo indicado no topo do arquivo) e
  o PDF compilado `figura1-arquitetura.pdf` (alternativa por
  `\includegraphics`). Três faixas, uma por camada (percepção, rede,
  aplicação), seguindo o §2.1: YF-S201 → ESP32 → roteador → Cloudflare (HTTPS +
  túnel) → API + banco no servidor doméstico; painel/app via polling pela
  Cloudflare; Vercel servindo o build estático. Compilado e conferido com o
  Tectonic (sem LaTeX na máquina; binário só no scratchpad da sessão). Na 1ª
  versão os rótulos "HTTPS POST" e "JDBC" ficavam espremidos entre os blocos;
  reposicionados.
- **Figura 2(b), candidatas:** capturas do app em produção (20/10, 21:50)
  recortadas sem a barra do navegador — `figura2b-consumo-apto201.png`
  (consumo de 7 dias do apto 201) e `figura2-sensor-ao-vivo-201.png` (vazão ao
  vivo; recortada antes de "Detalhes", que mostrava o modo de medição de
  latência). Originais em `docs/screenshots/`.
  **Ressalva:** os 34,9 L de 20/10 e os 38,1 L de 16/10 vieram do sensor real,
  mas com o K teórico e — se os pulsos foram gerados soprando ou girando o
  rotor — não são consumo de água. Para a figura de "consumo de um
  apartamento", melhor refazer a captura depois dos ensaios com água.

## 6. Estado do repositório ao final

- Novos: `docs/scripts/analise/serial_log.py`, `exportar_leituras.py`,
  `docs/resultados/exploratorio-rede-com-download-20-10.log`, `docs/figuras/`.
- Alterados: `docs/scripts/analise/entrega.py`, `requirements.txt`,
  `docs/scripts/simulador.py`, `docs/scripts/.gitignore`,
  `docs/scripts/analise/README.md`, `docs/progresso.md`, `docs/README.md`,
  `docs/stack-19-10.md` (nota sobre o relatório removido), `CLAUDE.md`.
- Ainda não commitados: `docs/scripts/analise/` e o PDF de 20/10, além do acima.
- Próximo: Etapa 0 do roteiro — critério de L_tot no Overleaf, firmware novo
  no ESP32, portal apontando para a API pública, conferência do apto 201 no
  app da Vercel.
