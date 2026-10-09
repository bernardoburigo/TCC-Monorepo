#pragma once

#include <cstddef>
#include <cstdint>

// ---------------------------------------------------------------------------
// Sensor de fluxo (Sprint 1)
// ---------------------------------------------------------------------------

// Pino digital conectado ao sinal do sensor YF-S201 (efeito Hall).
// GPIO27 é interrupt-capable no ESP32 e não é um pino de bootstrapping.
constexpr int SENSOR_PULSE_PIN = 27;

// Pulsos por litro. Valor de referência do datasheet do YF-S201
// (f ≈ 7.5 Hz por L/min => 7.5 * 60 = 450 pulsos por litro).
// ATENÇÃO: sensores baratos variam por unidade — este é só o valor PADRÃO.
// O valor efetivo fica na NVS e é ajustado pelo portal cativo após calibrar
// com proveta/cronômetro (ver DeviceConfig).
constexpr float PULSES_PER_LITER = 450.0f;

// Intervalo de amostragem/impressão no Serial, em milissegundos.
constexpr unsigned long SAMPLE_INTERVAL_MS = 1000;

// ---------------------------------------------------------------------------
// Envio para a API (Sprint 3)
// ---------------------------------------------------------------------------

// Uma leitura (um POST) por janela. Cada janela soma os pulsos de várias
// amostras de SAMPLE_INTERVAL_MS. Sempre envia, mesmo com 0 pulsos (heartbeat).
constexpr unsigned long POST_WINDOW_MS = 5000;

// Leituras retidas na RAM enquanto o backend está inacessível (~16 min a 5 s).
// Cheia: descarta a mais antiga. Perdida se o ESP32 reiniciar.
constexpr size_t QUEUE_CAPACITY = 200;

constexpr int HTTP_TIMEOUT_MS = 4000;

// Recuo entre tentativas após falha (dobra até o máximo). 401 usa o máximo direto.
constexpr uint32_t BACKOFF_BASE_MS = 5000;
constexpr uint32_t BACKOFF_MAX_MS = 60000;

// ---------------------------------------------------------------------------
// Wi-Fi / hora / configuração (Sprint 3)
// ---------------------------------------------------------------------------

// Valores PADRÃO dos campos do portal cativo; o efetivo fica na NVS.
// sensorId e token não têm padrão de propósito: são segredos por dispositivo,
// vêm de POST /api/sensores e não devem ir para o git.
constexpr const char* DEFAULT_API_URL = "http://192.168.0.10:8080";

constexpr const char* PORTAL_AP_NAME = "TCC-Sensor-Setup";
constexpr uint32_t PORTAL_TIMEOUT_S = 180;   // depois disso segue offline
constexpr uint32_t WIFI_CONNECT_TIMEOUT_S = 20;
constexpr unsigned long WIFI_RETRY_INTERVAL_MS = 30000;

// Segurar o botão BOOT (GPIO0) por este tempo, com o firmware rodando, apaga
// as credenciais Wi-Fi e reinicia no portal. (Segurar BOOT durante o reset
// entra no modo de download do ESP32 — por isso só vale com o firmware rodando.)
constexpr int RESET_BUTTON_PIN = 0;
constexpr unsigned long RESET_HOLD_MS = 3000;

constexpr const char* NTP_SERVER_1 = "pool.ntp.org";
constexpr const char* NTP_SERVER_2 = "time.google.com";

// Hora anterior a esta significa "NTP ainda não sincronizou" (o ESP32 parte de 1970).
constexpr int64_t MIN_VALID_EPOCH_MS = 1704067200000LL;  // 2024-01-01T00:00:00Z
