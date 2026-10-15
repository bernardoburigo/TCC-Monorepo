# Deploy público — servidor caseiro + Vercel

Guia autocontido para colocar o sistema no ar publicamente: backend +
banco no servidor caseiro (exposto via Cloudflare Tunnel), app Web na
Vercel, tudo sob o mesmo domínio por subdomínio. Decidido e planejado em
15/10/2026 (ver `docs/stack-15-10.md`); contexto completo do projeto em
`CLAUDE.md`.

Pensado para ser seguido por uma sessão de Claude Code rodando **no
próprio servidor** (depois de `git clone` deste repositório), sem depender
do histórico desta conversa.

## Arquitetura

```
app.SEUDOMINIO.com  --DNS only-->  Vercel (build estático do Expo Web)
                                         |
                                         | chama a API via EXPO_PUBLIC_API_URL
                                         v
api.SEUDOMINIO.com  --proxied-->  Cloudflare Tunnel  -->  cloudflared (no servidor)
                                                                |
                                                                v
                                                   backend Spring Boot (porta 8080,
                                                   bindada em 127.0.0.1)  -->  Postgres/TimescaleDB
```

Nada fica exposto diretamente à internet pelo roteador — nem porta
aberta, nem IP residencial. O `cloudflared` faz uma conexão **de saída**
para a rede da Cloudflare; a entrada acontece pela borda da Cloudflare.

Custo recorrente: só o registro do domínio (~R$40-70/ano). Cloudflare
(DNS + Tunnel) e Vercel (plano Hobby) cobrem o resto sem custo para o
volume de uma demonstração de TCC. O plano Hobby da Vercel é não-comercial
por termos de uso — ok para este projeto.

## Parte B — ações manuais (fora de terminal, via navegador)

Essas ações não dependem do servidor — podem ser feitas de qualquer
dispositivo, a qualquer momento antes da Parte C.

1. **Comprar um domínio** em qualquer registrador (ex.: Registro.br para
   `.com.br`, Namecheap/Porkbun para outros TLDs).
2. **Adicionar o domínio à Cloudflare** (conta gratuita): a Cloudflare
   fornece 2 nameservers para configurar no registrador do domínio.
   Propagação: minutos a ~24h.
3. **Criar o projeto na Vercel**, importando o repositório do GitHub
   (`bernardoburigo/TCC-Monorepo`):
   - **Root Directory:** `app`
   - **Framework Preset:** definir manualmente (não confiar no autodetect
     — Expo não é um preset nativo garantido da Vercel)
   - **Build Command:** `npm run build:web`
   - **Output Directory:** `dist`
   - **Install Command:** padrão (`npm install`)
   - **Node.js Version:** 22.x (Settings → General — redundante com o
     `engines` do `app/package.json`, mas confirme os dois)
   - **Environment Variables** (ambiente Production):
     - `EXPO_PUBLIC_API_URL=https://api.SEUDOMINIO.com`
     - `EXPO_PUBLIC_USE_MOCK_DATA=false`
4. **Domínio customizado na Vercel:** em Settings → Domains do projeto,
   adicionar `app.SEUDOMINIO.com`. A Vercel mostra o CNAME exato (algo
   como `cname.vercel-dns.com`) — criar esse registro na Cloudflare como
   **DNS only** (nuvem **cinza**, não laranja). Isso é obrigatório: a
   emissão do certificado TLS da Vercel e o roteamento dela esperam
   conexão direta; com o proxy da Cloudflare ligado, a validação quebra.

## Parte C — no servidor (Ubuntu Server, ThinkCentre)

### C.1 — Hardening básico (antes de qualquer coisa pública)

```bash
sudo apt update && sudo apt upgrade -y
```

SSH por chave pública, com login por senha desabilitado
(`/etc/ssh/sshd_config`: `PasswordAuthentication no`, depois
`sudo systemctl restart sshd`) — garanta que a chave já funciona **antes**
de desabilitar a senha.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH   # considere restringir ao CIDR da LAN de casa
sudo ufw enable
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
# opcional, barato de configurar:
sudo apt install -y fail2ban
```

**Atenção:** o Docker manipula as chains do `iptables` diretamente e
historicamente ignora regras do `ufw` em portas publicadas via `-p`. O
`ufw` aqui cobre só o SSH — a proteção real das portas do Docker vem do
bind em `127.0.0.1` (`BIND_HOST` no `.env`, passo C.3), não do `ufw`.

### C.2 — Docker, Git, clone do repositório

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # relogar (ou `newgrp docker`) pra valer sem sudo
sudo apt install -y git

git clone https://github.com/bernardoburigo/TCC-Monorepo.git
cd TCC-Monorepo
```

(Repositório público — confirmado em 15/10/2026 — clone sem autenticação.)

### C.3 — Segredos de produção

```bash
cat > .env <<EOF
JWT_SECRET=$(openssl rand -base64 48)
POSTGRES_PASSWORD=$(openssl rand -base64 24)
DB_PASSWORD=<igual ao POSTGRES_PASSWORD acima>
PGADMIN_DEFAULT_PASSWORD=$(openssl rand -base64 24)
APP_CORS_ALLOWED_ORIGINS=https://app.SEUDOMINIO.com
BIND_HOST=127.0.0.1
EOF
```

`DB_PASSWORD` e `POSTGRES_PASSWORD` autenticam a mesma conta — precisam
ser idênticos. `BIND_HOST=127.0.0.1` faz `db`/`backend`/`pgadmin`
publicarem suas portas só em localhost (em dev, sem essa variável, o
padrão continua `0.0.0.0`) — só o `cloudflared` local (passo C.5) precisa
alcançar a 8080. Esse `.env` **nunca** deve ser commitado (já coberto pelo
`.gitignore` da raiz).

### C.4 — Subir o stack

```bash
docker compose up -d --build
curl localhost:8080/actuator/health   # {"status":"UP"} antes de ir adiante
```

(Opcional, dados de demonstração além do sensor real:
`python3 docs/scripts/simulador.py provisionar` e `historico --horas 48`.)

### C.5 — Cloudflare Tunnel

```bash
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared

cloudflared tunnel login
cloudflared tunnel create tcc-backend
```

Crie `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID-gerado-no-create>
credentials-file: /etc/cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: api.SEUDOMINIO.com
    service: http://localhost:8080
  - service: http_status:404   # catch-all obrigatório; sem isso o cloudflared não inicia
```

```bash
cloudflared tunnel route dns tcc-backend api.SEUDOMINIO.com
```

**Teste em foreground antes de virar serviço:**

```bash
cloudflared tunnel run tcc-backend
# noutro terminal/dispositivo fora da rede de casa:
curl https://api.SEUDOMINIO.com/actuator/health
```

Só depois de confirmar que responde, instale como serviço persistente:

```bash
sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/config.yml /etc/cloudflared/
sudo cp ~/.cloudflared/<TUNNEL_ID>.json /etc/cloudflared/
sudo cloudflared service install
sudo systemctl status cloudflared   # confirme "active (running)", sem erro de permissão
```

O serviço systemd roda com outro usuário/HOME e **não enxerga**
`~/.cloudflared/` do usuário normal — copiar os arquivos para
`/etc/cloudflared/` (acima) é o que evita o erro clássico de "permission
denied" lendo o credentials-file.

> Alternativa mais simples (troca config local por dashboard): criar o
> túnel pelo painel Cloudflare Zero Trust (Networks → Tunnels) e instalar
> com `sudo cloudflared service install <TOKEN>` — sem credentials-file
> local, sem o problema de permissão acima, mas a config de ingress fica
> só no dashboard, não versionada neste repositório.

Depois de qualquer edição em `config.yml`:
`sudo systemctl restart cloudflared` (não há reload automático).

### C.6 — Reconfigurar o ESP32

Com o firmware já rodando, segure o botão **BOOT** (GPIO0) por 3s — apaga
o Wi-Fi salvo e reabre o portal cativo `TCC-Sensor-Setup`. Reconfigure
Wi-Fi + troque a **URL da API** de `http://192.168.x.x:8080` para
`https://api.SEUDOMINIO.com`. Sem reflash — já é editável via NVS. O
`sensorId`/token continuam os mesmos.

## Verificação ponta a ponta

- `curl https://api.SEUDOMINIO.com/actuator/health` **de fora** da rede de
  casa (ex.: dados móveis) → `{"status":"UP"}`.
- Abrir `https://app.SEUDOMINIO.com`, logar, navegar para uma rota
  profunda (ex.: um apartamento) e dar refresh — confirma o `vercel.json`
  (rewrite de SPA).
- Expo Go no celular, `EXPO_PUBLIC_API_URL=https://api.SEUDOMINIO.com`,
  numa rede diferente da de casa.
- No app, o apartamento do sensor real deve aparecer com o selo **REAL**
  e atualizar por polling, batendo com o Serial do ESP32.
- No servidor: `sudo ufw status` + `ss -tlnp` — só a porta 22 deve
  aparecer ouvindo em interface pública; as portas do Docker só em
  `127.0.0.1`.

## Riscos aceitos (documentar na redação, mesmo padrão do `setInsecure()`
do firmware e do token em claro na LAN — ver `CLAUDE.md` §8)

- `/actuator/**` e `/swagger-ui/**`/`/v3/api-docs/**` são `permitAll()` no
  `SecurityConfig` — uma vez públicos, qualquer um vê o status do health
  check e o contrato completo da API (sem dado sensível real, é um
  protótipo). `show-details` já foi restrito a `when-authorized`
  (15/10/2026) para não vazar detalhes de banco/disco.
- `app.SEUDOMINIO.com` fica "DNS only" (sem proxy/WAF/cache da Cloudflare)
  por exigência da Vercel — só a proteção própria da Vercel se aplica
  nessa rota.
- O firmware usa `WiFiClientSecure::setInsecure()` para HTTPS — o TLS de
  verdade acontece ESP32↔borda da Cloudflare (handshake válido, cert
  genuíno); `setInsecure()` só significa que o ESP32 não valida a cadeia,
  então aceitaria também um MITM que se fizesse passar pela Cloudflare
  *dentro da própria rede local* do ESP32. Risco residual baixo numa LAN
  doméstica.
