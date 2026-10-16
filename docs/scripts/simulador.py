#!/usr/bin/env python3
"""Simulador mínimo de sensores de fluxo de água (Sprint 4).

Substitui o ESP32 enquanto o hardware não está disponível: cria sensores
marcados como `simulado` na API e envia leituras com o MESMO payload do
firmware (POST /api/leituras, header X-Sensor-Token):

  - `pulsos` e `volumeMlEstimado` são o DELTA da janela (nunca o acumulado);
  - `timestampLeitura` é o FIM da janela, em UTC, com milissegundos e `Z`;
  - `sequencia` incrementa a cada leitura enviada.

Todo dado gerado por este script é SIMULADO (CLAUDE.md, seção 6): os sensores
são criados com `simulado: true` e o app exibe o selo "SIMULADO". Nunca usar
estes dados como resultado de medição real na redação do TCC.

Só usa a biblioteca padrão do Python 3.9+ (sem pip install).

Uso típico:
    python3 docs/scripts/simulador.py provisionar --apartamentos 3
    python3 docs/scripts/simulador.py historico --horas 48
    python3 docs/scripts/simulador.py rodar
    python3 docs/scripts/simulador.py rodar --perfil 103=vazamento

Limitações conhecidas (a Sprint 5 evolui este script):
  - `historico` usa janelas de 60 s por padrão (o firmware real usa 5 s) para não
    precisar de dezenas de milhares de POSTs; o volume total é equivalente, a
    resolução temporal é mais grosseira.
  - Sem simulação de queda de rede/reenvio nem de reinício do ESP32.
"""

import argparse
import json
import math
import os
import random
import signal
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
    FUSO = ZoneInfo("America/Sao_Paulo")
except Exception:  # sem tzdata: Brasil não tem horário de verão desde 2019
    FUSO = timezone(timedelta(hours=-3))

ESTADO_PADRAO = Path(__file__).with_name(".simulador-estado.json")
PULSOS_POR_LITRO = 450.0  # mesmo valor de referência do firmware (datasheet do YF-S201)
JANELA_PADRAO_S = 5       # janela de envio do firmware
PERFIS = ("normal", "ocioso", "vazamento")

SINDICO = {"nome": "Síndico Simulado", "email": "sindico.simulado@tcc.com", "senha": "senha12345"}
PROPRIETARIO = {"nome": "Proprietário Simulado", "email": "proprietario.simulado@tcc.com", "senha": "senha12345"}
NOME_CONDOMINIO = "Condomínio Simulado (TCC)"


class ErroSimulador(Exception):
    pass


# --------------------------------------------------------------------------- HTTP

def http(metodo, url, corpo=None, headers=None, timeout=10):
    """Retorna (status, json_ou_texto). Só levanta exceção em falha de rede."""
    dados = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(
        url, data=dados, method=metodo, headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            bruto = resp.read()
            return resp.status, (json.loads(bruto) if bruto else None)
    except urllib.error.HTTPError as erro:
        bruto = erro.read()
        try:
            return erro.code, (json.loads(bruto) if bruto else None)
        except ValueError:
            return erro.code, bruto.decode(errors="replace")
    except OSError as erro:
        # URLError (recusada/DNS), ConnectionResetError e TimeoutError (backend reiniciando,
        # rede caiu no meio da resposta). Todas viram ErroSimulador: o modo `rodar` registra e
        # tenta de novo na próxima janela em vez de derrubar o script.
        raise ErroSimulador(f"não consegui falar com {url}: {getattr(erro, 'reason', erro)}") from erro


def exigir(status, esperados, contexto, corpo=None):
    if status not in esperados:
        raise ErroSimulador(f"{contexto}: HTTP {status} {corpo if corpo is not None else ''}")


# --------------------------------------------------------------------------- estado

def carregar_estado(caminho):
    if not caminho.exists():
        raise ErroSimulador(f"estado não encontrado ({caminho}); rode `provisionar` primeiro")
    return json.loads(caminho.read_text())


def salvar_estado(caminho, estado):
    caminho.write_text(json.dumps(estado, indent=2, ensure_ascii=False))


# --------------------------------------------------------------------------- provisionamento

def login(api, credenciais):
    status, corpo = http("POST", f"{api}/api/auth/login",
                         {"email": credenciais["email"], "senha": credenciais["senha"]})
    exigir(status, (200,), f"login de {credenciais['email']}", corpo)
    return corpo["token"]


def cmd_provisionar(args):
    api = args.api.rstrip("/")
    caminho = Path(args.estado)
    estado = json.loads(caminho.read_text()) if caminho.exists() else {}
    admin = {"X-Admin-Token": args.admin_token}  # o registro de usuários não é público

    # síndico + condomínio (o registro do síndico cria o condomínio)
    status, corpo = http("POST", f"{api}/api/auth/registrar", {
        **SINDICO, "role": "SINDICO", "nomeCondominio": NOME_CONDOMINIO}, headers=admin)
    if status == 201:
        print(f"síndico criado: {SINDICO['email']}")
    else:
        exigir(status, (409,), "registrar síndico", corpo)  # 409 = já existe
        print(f"síndico já existia: {SINDICO['email']}")
    jwt = login(api, SINDICO)
    auth = {"Authorization": f"Bearer {jwt}"}

    status, condominios = http("GET", f"{api}/api/condominios", headers=auth)
    exigir(status, (200,), "listar condomínios", condominios)
    if not condominios:
        raise ErroSimulador("o síndico simulado não tem condomínio")
    condominio = condominios[0]

    status, existentes = http("GET", f"{api}/api/apartamentos?condominioId={condominio['id']}", headers=auth)
    exigir(status, (200,), "listar apartamentos", existentes)
    por_numero = {a["numero"]: a for a in existentes}

    sensores_estado = {s["apartamentoId"]: s for s in estado.get("sensores", [])}
    sensores = []
    for i in range(1, args.apartamentos + 1):
        numero = str(100 + i)
        apto = por_numero.get(numero)
        if apto is None:
            status, apto = http("POST", f"{api}/api/apartamentos",
                                {"condominioId": condominio["id"], "numero": numero}, headers=auth)
            exigir(status, (201,), f"criar apartamento {numero}", apto)
            print(f"apartamento {numero} criado")

        sensor = sensores_estado.get(apto["id"])
        if sensor is None:
            # o token só é exibido na criação: sem ele no arquivo de estado, cria um sensor novo
            status, criado = http("POST", f"{api}/api/sensores", {
                "apartamentoId": apto["id"], "identificador": f"Sensor simulado {numero}", "simulado": True},
                headers=auth)
            exigir(status, (201,), f"criar sensor do apartamento {numero}", criado)
            sensor = {"apartamentoId": apto["id"], "numero": numero, "sensorId": criado["id"],
                      "token": criado["token"], "sequencia": 0}
            print(f"sensor simulado criado no apartamento {numero}")
        sensores.append(sensor)

    # proprietário vinculado ao 1º apartamento (para testar a visão por papel)
    proprietario_ok = estado.get("proprietario")
    if not proprietario_ok:
        status, corpo = http("POST", f"{api}/api/auth/registrar", {
            **PROPRIETARIO, "role": "PROPRIETARIO", "apartamentoIds": [sensores[0]["apartamentoId"]]}, headers=admin)
        if status == 201:
            print(f"proprietário criado: {PROPRIETARIO['email']} (apartamento {sensores[0]['numero']})")
        else:
            exigir(status, (409,), "registrar proprietário", corpo)
            print(f"proprietário já existia: {PROPRIETARIO['email']}")

    novo = {"api": api, "condominio": {"id": condominio["id"], "nome": condominio["nome"]},
            "sindico": SINDICO, "proprietario": {**PROPRIETARIO, "numero": sensores[0]["numero"]},
            "sensores": sensores}
    salvar_estado(caminho, novo)
    print(f"\nestado salvo em {caminho}")
    print(f"  síndico:      {SINDICO['email']} / {SINDICO['senha']}")
    print(f"  proprietário: {PROPRIETARIO['email']} / {PROPRIETARIO['senha']} (só o apartamento {sensores[0]['numero']})")


# --------------------------------------------------------------------------- geração de consumo

# (nome, vazão em L/min, duração mín/máx em s, eventos/hora por faixa de hora local)
def _taxa(hora, madrugada, dia, pico):
    if 0 <= hora < 5:
        return madrugada
    if 6 <= hora < 9 or 18 <= hora < 22:
        return pico
    return dia


EVENTOS = (
    ("torneira", 3.5, (15, 90), lambda h: _taxa(h, 0.1, 2.5, 7.0)),
    ("descarga", 15.0, (25, 40), lambda h: _taxa(h, 0.1, 0.8, 1.5)),
    ("chuveiro", 8.0, (300, 600), lambda h: _taxa(h, 0.0, 0.05, 0.45)),
)


class Uso:
    """Consumo de um apartamento: eventos aleatórios com intensidade por hora do dia.

    `vazao_media(agora, dt_s)` devolve a vazão média (L/min) da janela [agora-dt, agora].
    """

    def __init__(self, perfil, rng):
        self.perfil = perfil
        self.rng = rng
        self.ativos = []  # [segundos_restantes, vazao_l_min]

    def vazao_media(self, agora, dt_s):
        if self.perfil == "ocioso":
            return 0.0

        hora = agora.astimezone(FUSO).hour
        for _nome, vazao, (dur_min, dur_max), taxa in EVENTOS:
            # chegadas de Poisson: P(pelo menos 1 evento na janela) ≈ 1 - e^(-λ·dt)
            if self.rng.random() < 1 - math.exp(-taxa(hora) / 3600.0 * dt_s):
                self.ativos.append([self.rng.uniform(dur_min, dur_max), vazao * self.rng.uniform(0.85, 1.15)])

        acumulado = 0.0  # L/min · s
        restantes = []
        for evento in self.ativos:
            usado = min(evento[0], dt_s)
            acumulado += evento[1] * usado
            evento[0] -= usado
            if evento[0] > 0:
                restantes.append(evento)
        self.ativos = restantes
        vazao = acumulado / dt_s

        if self.perfil == "vazamento":
            # fluxo contínuo e baixo (0,3–0,5 L/min) o tempo todo, por cima do uso normal
            vazao += self.rng.uniform(0.3, 0.5)
        return vazao


def leitura_da_janela(vazao_l_min, dt_s):
    """Quantiza como o firmware: conta pulsos inteiros e DERIVA o volume dos pulsos."""
    pulsos = round(vazao_l_min * (dt_s / 60.0) * PULSOS_POR_LITRO)
    volume_ml = pulsos / PULSOS_POR_LITRO * 1000.0
    return pulsos, volume_ml


def iso_utc(instante):
    return instante.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + f"{instante.microsecond // 1000:03d}Z"


def enviar(api, sensor, instante, pulsos, volume_ml):
    payload = {"sensorId": sensor["sensorId"], "timestampLeitura": iso_utc(instante),
               "pulsos": pulsos, "volumeMlEstimado": round(volume_ml, 4), "sequencia": sensor["sequencia"]}
    status, corpo = http("POST", f"{api}/api/leituras", payload, headers={"X-Sensor-Token": sensor["token"]})
    if status in (201, 409):  # 409 = já existe (igual ao firmware: conta como entregue)
        sensor["sequencia"] += 1
    return status, corpo


def montar_usos(estado, perfis, semente):
    rng = random.Random(semente)
    return {s["sensorId"]: Uso(perfis.get(s["numero"], "normal"), random.Random(rng.random())) for s in estado["sensores"]}


def parse_perfis(itens):
    perfis = {}
    for item in itens or []:
        numero, _, perfil = item.partition("=")
        if perfil not in PERFIS:
            raise ErroSimulador(f"perfil inválido em '{item}' (use NUMERO=perfil, perfis: {', '.join(PERFIS)})")
        perfis[numero] = perfil
    return perfis


# --------------------------------------------------------------------------- comandos

def cmd_historico(args):
    estado = carregar_estado(Path(args.estado))
    api = estado["api"]
    usos = montar_usos(estado, parse_perfis(args.perfil), args.semente)

    fim = datetime.now(timezone.utc).replace(microsecond=0)
    inicio = fim - timedelta(hours=args.horas)
    janela = args.janela
    total = int((fim - inicio).total_seconds() // janela)
    print(f"histórico SIMULADO: {args.horas} h, janelas de {janela} s, "
          f"{len(estado['sensores'])} sensor(es) => {total * len(estado['sensores'])} leituras")

    erros = 0
    for i in range(1, total + 1):
        instante = inicio + timedelta(seconds=i * janela)
        for sensor in estado["sensores"]:
            vazao = usos[sensor["sensorId"]].vazao_media(instante, janela)
            pulsos, volume = leitura_da_janela(vazao, janela)
            status, corpo = enviar(api, sensor, instante, pulsos, volume)
            if status not in (201, 409):
                erros += 1
                print(f"  falha {status}: {corpo}")
                if erros >= 10:
                    raise ErroSimulador("muitas falhas seguidas, abortando")
        if i % 500 == 0:
            print(f"  {i}/{total} janelas")
    salvar_estado(Path(args.estado), estado)
    print("histórico concluído")


def cmd_rodar(args):
    caminho = Path(args.estado)
    estado = carregar_estado(caminho)
    api = estado["api"]
    perfis = parse_perfis(args.perfil)
    usos = montar_usos(estado, perfis, args.semente)
    intervalo = args.intervalo

    parar = {"sim": False}
    signal.signal(signal.SIGINT, lambda *_: parar.update(sim=True))
    signal.signal(signal.SIGTERM, lambda *_: parar.update(sim=True))

    resumo_perfis = ", ".join(
        "{}={}".format(s["numero"], perfis.get(s["numero"], "normal")) for s in estado["sensores"])
    print(f"enviando leituras SIMULADAS a cada {intervalo} s para {len(estado['sensores'])} sensor(es) "
          f"[{resumo_perfis}] (Ctrl+C para parar)")

    proximo = time.time()
    ultimo_salvamento = time.time()
    while not parar["sim"]:
        proximo += intervalo
        pausa = proximo - time.time()
        if pausa > 0:
            time.sleep(pausa)
        elif pausa < -intervalo:      # ficou muito atrasado (ex.: máquina suspensa): não acumula rajada
            proximo = time.time()

        instante = datetime.now(timezone.utc)
        for sensor in estado["sensores"]:
            vazao = usos[sensor["sensorId"]].vazao_media(instante, intervalo)
            pulsos, volume = leitura_da_janela(vazao, intervalo)
            try:
                status, _ = enviar(api, sensor, instante, pulsos, volume)
            except ErroSimulador as erro:
                status = f"ERRO ({erro})"
            perfil = perfis.get(sensor["numero"], "normal")
            print(f"[{instante.astimezone(FUSO):%H:%M:%S}] apto {sensor['numero']:>4} {perfil:<9} "
                  f"pulsos={pulsos:<4} vol={volume:8.2f} mL seq={sensor['sequencia'] - 1:<6} -> {status}")

        if time.time() - ultimo_salvamento > 60:
            salvar_estado(caminho, estado)
            ultimo_salvamento = time.time()

    salvar_estado(caminho, estado)
    print("\nparado; estado salvo")


def main():
    # saída em tempo real mesmo redirecionada para arquivo/pipe (acompanhar com `tail -f`)
    sys.stdout.reconfigure(line_buffering=True)
    parser = argparse.ArgumentParser(description="Simulador mínimo de sensores de fluxo de água (dados SIMULADOS).")
    parser.add_argument("--estado", default=str(ESTADO_PADRAO), help="arquivo de estado (tokens dos sensores)")
    sub = parser.add_subparsers(dest="comando", required=True)

    p = sub.add_parser("provisionar", help="cria síndico, condomínio, apartamentos e sensores simulados")
    p.add_argument("--api", default="http://localhost:8080")
    p.add_argument("--apartamentos", type=int, default=3)
    p.add_argument("--admin-token", default=os.environ.get("TCC_ADMIN_TOKEN", "dev-admin-token"),
                   help="X-Admin-Token do registro (APP_REGISTRO_ADMIN_TOKEN do backend); padrão: env TCC_ADMIN_TOKEN ou o valor de dev")
    p.set_defaults(func=cmd_provisionar)

    for nome, ajuda, func in (("historico", "gera histórico (backfill) até agora", cmd_historico),
                              ("rodar", "envia leituras em tempo real", cmd_rodar)):
        p = sub.add_parser(nome, help=ajuda)
        p.add_argument("--perfil", action="append", metavar="NUMERO=PERFIL",
                       help=f"perfil por apartamento ({', '.join(PERFIS)}); padrão: normal. Ex.: --perfil 103=vazamento")
        p.add_argument("--semente", type=int, default=None, help="semente do gerador (resultado reproduzível)")
        if nome == "historico":
            p.add_argument("--horas", type=int, default=24)
            p.add_argument("--janela", type=int, default=60, help="janela em segundos (padrão 60; firmware real: 5)")
        else:
            p.add_argument("--intervalo", type=int, default=JANELA_PADRAO_S, help="segundos entre leituras")
        p.set_defaults(func=func)

    args = parser.parse_args()
    try:
        args.func(args)
    except ErroSimulador as erro:
        print(f"erro: {erro}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
