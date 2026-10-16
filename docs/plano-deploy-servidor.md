# Plano de execução — Deploy público (para o Claude Code do servidor)

Você é o Claude Code rodando no ThinkCentre (Ubuntu Server, hostname "zero").
Leia o `CLAUDE.md` e `docs/deploy-servidor.md` do repositório para contexto; este
arquivo é o roteiro de execução e tem precedência sobre ele em caso de divergência.

## Estado atual

- **Parte A (repositório): 100% concluída.** `.gitignore` com `.env`,
  `docker-compose.yml` parametrizado por `${VAR:-padrão}` (inclui
  `APP_CORS_ALLOWED_ORIGINS` e `BIND_HOST`), `app/vercel.json`, `engines` do
  `app/package.json`. Basta `git pull` no `main`.
- **Parte B (navegador, feita pelo usuário): apenas aguardando a transição de
  DNS.** Domínio `bernardoburigo.com.br` comprado no Registro.br; projeto da
  Vercel criado e funcionando em `tcc.bernardoburigo.com.br`; variáveis da
  Vercel já usam `https://apitcc.bernardoburigo.com.br`. A zona na Cloudflare
  ainda está *Pending* até os nameservers propagarem.
- **Parte C (servidor): é o que você executa agora.**

## Nomes definitivos

| Papel | Host |
|---|---|
| App Web (Vercel, DNS only) | `tcc.bernardoburigo.com.br` |
| API (Cloudflare Tunnel, proxied) | `apitcc.bernardoburigo.com.br` |
| Túnel | `tcc-backend` → `http://localhost:8080` |

## Regras de execução

- O servidor já foi configurado antes (playit.gg, algumas portas liberadas) e o
  acesso é estável: **não altere SSH nem o firewall (ufw)**. Hardening completo
  foi dispensado de propósito.
- Antes de qualquer coisa, verifique exposição: `sudo ss -tlnp`,
  `sudo ufw status verbose`, `systemctl list-units | grep -i playit`. Se o
  playit.gg ainda expõe algo que não é mais usado, **pergunte ao usuário**
  antes de parar/desabilitar.
- Nunca commite `.env` nem `~/.cloudflared/*`. Nunca imprima segredos no chat
  além do estritamente necessário.
- Peça confirmação ao usuário antes de ações que exijam o navegador
  (autorizar o `cloudflared tunnel login`) ou que dependam do DNS.

## Passos

### C1 — Sistema
`sudo apt update && sudo apt upgrade -y` (reinicie só se o usuário concordar).

### C2 — Docker e Git
Docker Engine + plugin Compose (script oficial `get.docker.com` ou repo apt) e
`git`. `sudo usermod -aG docker $USER` (pode exigir novo login). Clone
`https://github.com/bernardoburigo/TCC-Monorepo.git` (público, sem token) e
entre na pasta. Confirme que o `docker-compose.yml` contém
`APP_CORS_ALLOWED_ORIGINS`; se não contiver, o `git pull` está desatualizado —
avise o usuário para dar push do que falta.

### C3 — `.env` de produção (ao lado do `docker-compose.yml`)
```
JWT_SECRET=<openssl rand -base64 48>
POSTGRES_PASSWORD=<openssl rand -base64 24>
DB_PASSWORD=<IDÊNTICO ao POSTGRES_PASSWORD>
PGADMIN_DEFAULT_PASSWORD=<openssl rand -base64 24>
APP_CORS_ALLOWED_ORIGINS=https://tcc.bernardoburigo.com.br
BIND_HOST=127.0.0.1
APP_REGISTRO_ADMIN_TOKEN=<openssl rand -hex 32>
```
`DB_PASSWORD` e `POSTGRES_PASSWORD` autenticam a mesma conta; se diferirem, o
backend não conecta. `chmod 600 .env`. Confirme com `git status` que o `.env`
não aparece como não rastreado.

### C4 — Subir o stack
`docker compose up -d --build`, depois `curl localhost:8080/actuator/health`
→ `{"status":"UP"}`. Confira que Postgres (5435), backend (8080) e pgAdmin
(5050) escutam só em `127.0.0.1` (`sudo ss -tlnp`). Confirme também o CORS:
```
curl -si -H "Origin: https://tcc.bernardoburigo.com.br" \
  localhost:8080/actuator/health | grep -i access-control-allow-origin
```

### C5 — Cloudflare Tunnel
1. Instalar `cloudflared` (repo apt da Cloudflare, conforme `docs/deploy-servidor.md`).
2. **Aguarde a zona `bernardoburigo.com.br` ficar *Active* na Cloudflare**
   (pergunte ao usuário). `cloudflared tunnel login` (o usuário abre a URL no
   navegador e seleciona o domínio) e `cloudflared tunnel create tcc-backend`.
3. `config.yml` (ingress termina com o catch-all, obrigatório):
   ```yaml
   tunnel: <TUNNEL_ID>
   credentials-file: /etc/cloudflared/<TUNNEL_ID>.json
   ingress:
     - hostname: apitcc.bernardoburigo.com.br
       service: http://localhost:8080
     - service: http_status:404
   ```
4. `cloudflared tunnel route dns tcc-backend apitcc.bernardoburigo.com.br`
5. Teste em foreground (`cloudflared tunnel run tcc-backend`) e peça ao usuário
   para abrir `https://apitcc.bernardoburigo.com.br/actuator/health` **de fora
   da rede de casa** (dados móveis).
6. Só depois: copiar `config.yml` e `<TUNNEL_ID>.json` para `/etc/cloudflared/`
   (o serviço systemd não enxerga `~/.cloudflared/`), `sudo cloudflared service
   install`, `systemctl status cloudflared` → *active (running)*.
   Edições futuras em `config.yml`: `sudo systemctl restart cloudflared`.
   (Alternativa: túnel criado pelo painel Zero Trust + `service install <TOKEN>`.)

### C6 — Dados do banco (o banco do servidor começa vazio)
O sensor `ESP32-REAL-201` e seu `sensorId`/token só existem no banco da
máquina de desenvolvimento. No servidor, via Swagger/API em
`http://localhost:8080` (ou `apitcc...` depois do túnel): registrar o síndico,
criar condomínio, apartamento 201 e sensor com `simulado=false`. **Entregue ao
usuário o `sensorId` e o token novos** — ele os digitará no portal do ESP32.
(Opcional, demonstração: `python3 docs/scripts/simulador.py provisionar` e
`historico --horas 48`.)

### C7 — ESP32 (ação do usuário, você orienta)
Segurar BOOT por 3 s com o firmware rodando → portal `TCC-Sensor-Setup` →
Wi-Fi, **URL `https://apitcc.bernardoburigo.com.br`**, **sensorId e token novos**
(C6). Sem reflash. Conferir no Serial o envio com HTTP 201 e a leitura chegando
(`GET /api/apartamentos/{id}/consumo`).

## Verificação ponta a ponta
1. `curl https://apitcc.bernardoburigo.com.br/actuator/health` de rede externa → `UP`.
2. `https://tcc.bernardoburigo.com.br`: login funciona (sem erro de CORS no
   console), rota profunda + refresh funciona.
3. Apartamento 201 mostra o selo **REAL** e atualiza por polling, batendo com o Serial.
4. `sudo ss -tlnp`: nada do projeto escutando fora de `127.0.0.1`.
5. Expo Go em rede diferente, com `EXPO_PUBLIC_API_URL=https://apitcc.bernardoburigo.com.br`.

## Ao terminar
Registre o que foi feito, bugs encontrados e o estado final em
`docs/stack-DD-MM.md` (complementando o do dia, se existir) e atualize
`docs/progresso.md`, conforme o `CLAUDE.md` (seção 9).

## Riscos aceitos (para a redação)
- `/actuator/**` e `/swagger-ui/**` públicos (`permitAll()`); sem dado sensível, protótipo.
- `tcc.bernardoburigo.com.br` em "DNS only" por exigência da Vercel (sem WAF/cache da Cloudflare).
- `X-Sensor-Token` em HTTPS até a borda da Cloudflare, mas o ESP32 usa `setInsecure()` (não valida o certificado).
