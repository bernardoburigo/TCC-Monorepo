#pragma once

#include <Arduino.h>

#include <string>

#include "DeviceConfig.h"

// Camada de rede do ESP32: Wi-Fi (WiFiManager), hora (NTP) e POST HTTP.
// Depende de hardware/Arduino, por isso não é testada no host; a lógica de
// decisão (payload, fila, política de retry) mora em lib/ e é testada lá.
namespace Network {

// Conecta ao Wi-Fi salvo ou abre o portal cativo (bloqueia até conectar ou
// PORTAL_TIMEOUT_S estourar). Salva na NVS o que for digitado no portal e
// atualiza cfg. Retorna true se ficou conectado; false = segue offline.
bool begin(DeviceConfig& cfg);

// Chamar a cada iteração do loop: reconecta periodicamente se caiu, inicia o
// NTP quando a rede volta e trata o botão BOOT (segurar RESET_HOLD_MS = reset).
void loop(unsigned long nowMs);

bool connected();

// Epoch UTC em ms, ou 0 se o NTP ainda não sincronizou.
int64_t nowEpochMs();
bool timeSynced();

// POST <apiUrl>/api/leituras com X-Sensor-Token. Retorna o status HTTP, ou o
// código negativo do HTTPClient em falha de transporte (conexão, timeout).
int postLeitura(const DeviceConfig& cfg, const std::string& json);

}  // namespace Network
