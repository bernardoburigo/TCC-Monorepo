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

## 4. Estado do repositório ao final

- Alterados: `docs/scripts/simulador.py`, `docs/scripts/.gitignore`,
  `docs/scripts/analise/README.md`, `docs/progresso.md`, `docs/README.md`,
  `docs/stack-19-10.md` (nota sobre o relatório removido), `CLAUDE.md`.
- Ainda não commitados: `docs/scripts/analise/` e o PDF de 20/10, além do acima.
- Próximo: Etapa 0 do roteiro — critério de L_tot no Overleaf, firmware novo
  no ESP32, portal apontando para a API pública, conferência do apto 201 no
  app da Vercel.
