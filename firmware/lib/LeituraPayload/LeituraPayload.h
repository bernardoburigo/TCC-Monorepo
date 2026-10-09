#pragma once

// Monta o payload de POST /api/leituras (contrato do CLAUDE.md, seção 3) sem
// depender de Arduino.h, para poder ser testado nativamente (env:native).

#include <cstdint>
#include <string>

// Uma janela de medição. `pulsos` e `volumeMl` são da JANELA (delta), nunca
// acumulados: o backend soma `volume_ml_estimado` para calcular o consumo.
struct Leitura {
    int64_t timestampMs;  // epoch UTC em ms do FIM da janela
    uint32_t pulsos;
    double volumeMl;
    uint32_t sequencia;   // incrementa a cada leitura enfileirada; zera no boot
};

// "2026-09-25T12:00:05.123Z" (UTC, sempre com 3 dígitos de milissegundo).
std::string formatIso8601(int64_t epochMs);

// {"sensorId","timestampLeitura","pulsos","volumeMlEstimado","sequencia"}
std::string buildLeituraJson(const char* sensorId, const Leitura& leitura);
