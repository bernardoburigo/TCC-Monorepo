# Progresso do projeto

Checklist vivo de status por sprint — complementa o cronograma da seção 5
do [`CLAUDE.md`](../CLAUDE.md) (fonte da verdade para datas e critérios) e
os diários detalhados em `docs/stack-DD-MM.md`. Atualizar ao fechar cada
sprint ou pendência relevante.

**Última atualização:** 09/10/2026.
**Prazo de entrega do artigo:** 09/11/2026 (faltam ~31 dias na última
atualização). **Maior risco:** disponibilidade do ESP32 físico — bloqueia
a Sprint 3 (Etapa B) e tudo que depende dela.

## Resumo rápido

| Sprint | Status |
|---|---|
| 0 — Setup | ✅ concluída |
| 1 — Firmware isolado | 🟡 concluída sem hardware (falta upload + calibração) |
| 2 — Backend + banco | ✅ concluída |
| 3 — Integração ESP32 → API | 🟡 código pronto; falta a Etapa B (hardware) |
| 4 — Dashboard/App | 🟡 validada com dados simulados + celular; falta dado real |
| 5 — Multi-apartamento | ⬜ não iniciada |
| 6 — Testes de bancada | ⬜ não iniciada (delineamento já definido no artigo) |
| 7 — Fechamento do artigo | ⬜ não iniciada |

## Por sprint

### Sprint 0 — Setup ✅
- [x] `docker-compose.yml` (TimescaleDB + backend + pgAdmin)
- [x] Validado: `docker compose up` sobe tudo sem erro
- [ ] Decisão sobre Timescale em provedor de nuvem (só necessária se a
      opção de deploy final for nuvem — ver seção 3 do `CLAUDE.md`)

### Sprint 1 — Firmware isolado 🟡
- [x] Leitura de pulsos via interrupt, cálculo de vazão, Serial
- [x] Lib `FlowMeter` pura, testada no host (`pio test -e native`)
- [x] Compila para o ESP32 (`pio run -e esp32dev`)
- [ ] **Upload no ESP32 físico** (bloqueado: hardware indisponível)
- [ ] **Calibração inicial** (proveta + cronômetro, comparar com o Serial)

### Sprint 2 — Backend + banco ✅
- [x] Entidades, migrações Flyway (V1–V8), CRUD completo
- [x] Autenticação JWT + API key por sensor
- [x] Ingestão com deduplicação, consulta de consumo on-the-fly
- [x] Teste de integração ponta a ponta (Testcontainers)

### Sprint 3 — Integração ESP32 → API 🟡
- [x] Firmware: WiFiManager, NTP, fila + reenvio, política por status HTTP
- [x] Backend: contrato de ingestão validado por curl (201/409/401/400)
- [x] 23 testes nativos do firmware + 7 testes de contrato no backend
- [ ] **Etapa B (requer ESP32 físico):**
  - [ ] Upload do firmware
  - [ ] Calibração da Sprint 1
  - [ ] Teste ponta a ponta (torneira → banco em segundos)
  - [ ] Teste de queda de rede (Wi-Fi e backend)

### Sprint 4 — Dashboard/App 🟡
- [x] App Web completo (login, lista, gráfico, detalhe do sensor, alerta)
- [x] Backend: endpoints `/api/me*`, status do sensor, CORS, fuso, alerta
- [x] Testes: backend 42, Jest 40 (33 do app + 7 do modo mock), e2e 32
- [x] **Celular (Expo Go) validado em 09/10** — conectividade LAN resolvida
      (rede Wi-Fi institucional bloqueava comunicação direta entre
      dispositivos; contornado)
- [x] **Modo mock do frontend** (09/10, `app/src/api/mock/`) — visualizar
      sem backend/Docker/simulador, desacoplado e fácil de remover
- [ ] **Dados reais do sensor no gráfico** (depende da Sprint 3, Etapa B)

### Sprint 5 — Multi-apartamento ⬜
- [ ] Réplica física (1-2 kits ESP32 + YF-S201 extras) e/ou
- [ ] Simulador formal de múltiplos sensores virtuais rodando junto do
      sensor real (o `docs/scripts/simulador.py` já cobre o básico; falta
      o cenário formal lado a lado com dado real)
- [ ] Dashboard mostrando 2+ apartamentos com consumos distintos e isolados

### Sprint 6 — Testes de bancada ⬜
Delineamento já fechado no artigo final (`docs/TCC_Bernardo_Goulart_Búrigo.pdf`,
Seção 2.6): 3 faixas de vazão (baixa/média/alta) × (10 repetições de
calibração + 30 de validação) = **120 ensaios**.
- [ ] Montar a bancada (reservatório, registro, mangueira, recipiente
      graduado, cronômetro)
- [ ] Campanha de calibração (10 repetições/faixa) — calcular o fator `K`
      ajustado (Equação 2 do artigo)
- [ ] Campanha de validação (30 repetições/faixa) com o `K` calibrado
- [ ] Calcular EA, EPM, desvio padrão/CV, taxa de entrega (rede estável +
      falhas induzidas), latência (ingestão + exibição) — processar em
      Python/pandas
- [ ] Gerar as Tabelas 3–8 e a Figura 4 do artigo com os números reais

### Sprint 7 — Fechamento do artigo ⬜
- [ ] Preencher todos os placeholders em vermelho do PDF com os dados reais
- [ ] Resolver as pendências da validação de paridade (seção abaixo)
- [ ] Gerar Figura 1 (arquitetura), Figura 2 (telas com dado real), Figura 3
      (foto da bancada)
- [ ] Revisão final do texto
- [ ] Entrega do artigo até 09/11/2026
- [ ] *(depois de 09/11, sem data ainda)* deploy de demonstração testado,
      preparação da apresentação/banca

## Pendências específicas para o artigo final

Achadas na validação de paridade entre `docs/TCC_Bernardo_Goulart_Búrigo.pdf`
e o `CLAUDE.md` (09/10/2026) — detalhe completo em `docs/stack-09-10.md`,
seção 1. Não são placeholders em vermelho, são ajustes de texto:

- [ ] **Alerta de vazamento:** a Conclusão do artigo (p.17) diz "não há
      alertas automáticos" e lista o alerta como trabalho futuro, mas ele
      já está implementado e testado desde a Sprint 4. Decidir: voltar a
      mencioná-lo no corpo do artigo (Seção 2.2/2.5, Tabela 9, Conclusão)
      ou manter a omissão deliberadamente — se mantida, ajustar a frase da
      limitação para não contradizer o próprio sistema.
- [ ] **Contagem de migrações:** o artigo (p.7) diz "sete migrações"
      Flyway; o repositório tem 8 (`V1`–`V8`, `V8` da Sprint 4). Corrigir
      para "oito".
- [ ] *(opcional, menor)* "a cada N segundos" (p.7) → considerar trocar
      por "5 s" (valor fixo desde a Sprint 3).
- [ ] *(opcional, menor)* "sete sprints" (p.6, resumo da metodologia) vs.
      as 8 da tabela do `CLAUDE.md` (Sprint 0 a 7) — confirmar se é
      intencional (não contar a Sprint 0 como sprint "de desenvolvimento").

## Placeholders do artigo que dependem da Sprint 6 (dados de bancada)

Lista rápida de onde os dados reais entram no PDF (todos marcados em
vermelho no documento):

- Modelo exato do ESP32 usado (Seção 2.2)
- Valores do datasheet do sensor adquirido, se diferentes do genérico
  (Equação 1, Seção 2.2)
- Ambiente de execução do backend: servidor doméstico ou nuvem (Seção 2.4)
- Capturas de tela do app com dado real (Figura 2)
- Foto da bancada de testes (Figura 3)
- Volume de referência `V`, menor divisão `Y mL`, quantidade de kits
  ESP32+YF-S201 (`um/N`) — Seção 2.6 e Tabela 2
- Todos os valores de `X`, `X,XX`, `XX,X%` nas Tabelas 3–8 e nas Figuras 4
  (erro por faixa, EPM antes/depois, CV, taxa de entrega, latência)
- Conclusões finais (Seção 3.5, 4) que dependem desses números
