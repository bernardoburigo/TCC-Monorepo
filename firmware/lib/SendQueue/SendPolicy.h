#pragma once

// Política de reenvio: o que fazer com a leitura da frente da fila conforme o
// resultado do POST. Sem Arduino.h, testável nativamente.

#include <cstdint>

enum class SendOutcome {
    Sent,       // 2xx ou 409: o backend já tem a leitura -> remove da fila
    Drop,       // 400: payload inválido, retry não resolve -> descarta e loga
    AuthError,  // 401: token/sensorId errado (configuração) -> recuo máximo
    Retry,      // timeout, sem rede, 5xx, demais códigos -> mantém na fila
};

// `status` é o código HTTP, ou o código negativo do HTTPClient em falha de transporte.
SendOutcome classifyHttpStatus(int status);

// Recuo exponencial: baseMs * 2^attempt, limitado a maxMs (sem overflow).
uint32_t nextBackoffMs(uint32_t attempt, uint32_t baseMs, uint32_t maxMs);
