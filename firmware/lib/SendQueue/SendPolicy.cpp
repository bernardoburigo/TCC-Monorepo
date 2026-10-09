#include "SendPolicy.h"

SendOutcome classifyHttpStatus(int status) {
    if ((status >= 200 && status < 300) || status == 409) {
        return SendOutcome::Sent;
    }
    if (status == 400) {
        return SendOutcome::Drop;
    }
    if (status == 401) {
        return SendOutcome::AuthError;
    }
    // Tudo o mais (falha de transporte, 5xx, 403/404 fora do contrato) é tratado
    // como transitório: reter na fila custa RAM; descartar custa consumo perdido.
    return SendOutcome::Retry;
}

uint32_t nextBackoffMs(uint32_t attempt, uint32_t baseMs, uint32_t maxMs) {
    uint64_t delay = baseMs;
    for (uint32_t i = 0; i < attempt && delay < maxMs; i++) {
        delay *= 2;
    }
    return delay > maxMs ? maxMs : static_cast<uint32_t>(delay);
}
