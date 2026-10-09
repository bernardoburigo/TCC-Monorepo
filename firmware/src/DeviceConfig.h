#pragma once

#include <Arduino.h>

// Configuração por dispositivo, persistida na NVS (Preferences) e editável pelo
// portal cativo do WiFiManager. Mantém segredos (sensorId, token) fora do git.
struct DeviceConfig {
    String apiUrl;          // ex.: http://192.168.0.10:8080 (sem barra final)
    String sensorId;        // UUID de POST /api/sensores
    String sensorToken;     // header X-Sensor-Token (retornado só na criação do sensor)
    float pulsesPerLiter;   // calibração deste sensor (YF-S201 varia por unidade)
};

// Preenche cfg com o que está na NVS; campos ausentes recebem o padrão de config.h.
void loadDeviceConfig(DeviceConfig& cfg);
void saveDeviceConfig(const DeviceConfig& cfg);

// Só envia se souber a quem pertence a leitura e como se autenticar.
bool isConfigured(const DeviceConfig& cfg);
