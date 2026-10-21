#!/usr/bin/env python3
"""Grava o monitor serial do ESP32 em arquivo, com a hora do PC (UTC) em cada linha.

Alternativa ao `pio device monitor | tee` que roda fora de um terminal interativo (em
segundo plano, por SSH). Abre a porta com DTR/RTS desligados para não reiniciar a placa
nem segurá-la em reset — reiniciar zeraria a `sequencia` e a fila de reenvio.

O log serve ao `entrega.py` (linhas `[FILA] seq=N enfileirada` e `[POST] seq=N -> 409`) e à
bancada (`pulsos_total`). Use um arquivo por condição de teste.

Uso:
    python3 docs/scripts/analise/serial_log.py docs/resultados/serial-estavel.log
    python3 docs/scripts/analise/serial_log.py saida.log --porta /dev/ttyUSB0 --minutos 60

Requer pyserial (já vem com o PlatformIO).
"""

import argparse
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import serial


def main():
    parser = argparse.ArgumentParser(description="Grava o Serial do ESP32 com a hora do PC em cada linha.")
    parser.add_argument("arquivo", help="arquivo de saída (acrescenta se já existir)")
    parser.add_argument("--porta", default="/dev/ttyACM0")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--minutos", type=float, default=None, help="encerra sozinho depois disso")
    parser.add_argument("--eco", action="store_true", help="também mostra as linhas no terminal")
    args = parser.parse_args()

    conexao = serial.Serial()
    conexao.port, conexao.baudrate, conexao.timeout = args.porta, args.baud, 1
    conexao.dtr = conexao.rts = False  # antes de abrir: abrir com os dois ativos reinicia/trava o ESP32
    conexao.open()

    caminho = Path(args.arquivo)
    caminho.parent.mkdir(parents=True, exist_ok=True)
    fim = time.monotonic() + args.minutos * 60 if args.minutos else None
    print(f"gravando {args.porta} em {caminho} (Ctrl+C para parar)", file=sys.stderr)
    with caminho.open("a", encoding="utf-8") as saida:
        try:
            while fim is None or time.monotonic() < fim:
                linha = conexao.readline().decode(errors="replace").rstrip()
                if not linha:
                    continue
                agora = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
                saida.write(f"{agora} {linha}\n")
                saida.flush()
                if args.eco:
                    print(f"{agora} {linha}")
        except KeyboardInterrupt:
            pass
    print("encerrado", file=sys.stderr)


if __name__ == "__main__":
    main()
