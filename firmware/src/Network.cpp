#include "Network.h"

#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <lwip/dns.h>
#include <sys/time.h>

#include "config.h"

namespace {

bool ntpStarted = false;
bool dnsApplied = false;
unsigned long lastWifiAttemptMs = 0;
unsigned long buttonPressedSinceMs = 0;

void startNtp() {
    // fuso 0/DST 0: o firmware trabalha e envia sempre em UTC
    configTime(0, 0, NTP_SERVER_1, NTP_SERVER_2);
    ntpStarted = true;
    Serial.println("[NTP] sincronização iniciada");
}

// O DNS do roteador falha de forma intermitente para o host da API (16/10: "DNS Failed" por
// minutos, mesmo com Wi-Fi e NTP ok). Prioriza um resolvedor público e mantém o do DHCP como
// reserva. O DHCP reaplica o DNS dele a cada nova conexão, então isto roda a cada reconexão.
void applyDnsServers() {
    IPAddress roteador = WiFi.dnsIP(0);
    ip_addr_t primario;
    ip_addr_t reserva;
    IP_ADDR4(&primario, 1, 1, 1, 1);
    if (roteador == IPAddress(0, 0, 0, 0) || roteador == IPAddress(1, 1, 1, 1)) {
        IP_ADDR4(&reserva, 8, 8, 8, 8);
    } else {
        IP_ADDR4(&reserva, roteador[0], roteador[1], roteador[2], roteador[3]);
    }
    dns_setserver(0, &primario);
    dns_setserver(1, &reserva);
    dnsApplied = true;
    Serial.printf("[DNS] 1.1.1.1 (principal) + %s (reserva)\n", IPAddress(ip_addr_get_ip4_u32(&reserva)).toString().c_str());
}

String trimTrailingSlash(String url) {
    url.trim();
    while (url.endsWith("/")) {
        url.remove(url.length() - 1);
    }
    return url;
}

// Cabeçalhos + POST + fechamento. O cliente (http/https) já foi passado ao begin().
int enviar(HTTPClient& http, const DeviceConfig& cfg, const std::string& json) {
    http.setConnectTimeout(HTTP_TIMEOUT_MS);
    http.setTimeout(HTTP_TIMEOUT_MS);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Sensor-Token", cfg.sensorToken);
    int status = http.POST(reinterpret_cast<uint8_t*>(const_cast<char*>(json.data())), json.size());
    http.end();
    return status;
}

}  // namespace

namespace Network {

bool begin(DeviceConfig& cfg) {
    WiFi.mode(WIFI_STA);

    // Parâmetros declarados ANTES do WiFiManager: ele guarda ponteiros para eles e
    // precisam sobreviver ao destrutor dele.
    char pplText[16];
    snprintf(pplText, sizeof(pplText), "%.2f", cfg.pulsesPerLiter);

    WiFiManagerParameter paramUrl("apiUrl", "URL da API (ex.: http://192.168.0.10:8080)", cfg.apiUrl.c_str(), 96);
    WiFiManagerParameter paramSensorId("sensorId", "sensorId (UUID do sensor)", cfg.sensorId.c_str(), 40);
    WiFiManagerParameter paramToken("token", "Token do sensor (X-Sensor-Token)", cfg.sensorToken.c_str(), 96);
    WiFiManagerParameter paramPpl("ppl", "Pulsos por litro (calibracao)", pplText, 12);
    bool salvarConfig = false;

    WiFiManager wm;
    wm.setConfigPortalTimeout(PORTAL_TIMEOUT_S);
    wm.setConnectTimeout(WIFI_CONNECT_TIMEOUT_S);
    wm.addParameter(&paramUrl);
    wm.addParameter(&paramSensorId);
    wm.addParameter(&paramToken);
    wm.addParameter(&paramPpl);
    wm.setSaveConfigCallback([&salvarConfig]() { salvarConfig = true; });

    Serial.printf("[WiFi] conectando (portal '%s' abre se não houver rede salva)...\n", PORTAL_AP_NAME);
    bool conectado = wm.autoConnect(PORTAL_AP_NAME);

    if (salvarConfig) {
        cfg.apiUrl = trimTrailingSlash(paramUrl.getValue());
        cfg.sensorId = paramSensorId.getValue();
        cfg.sensorId.trim();
        cfg.sensorToken = paramToken.getValue();
        cfg.sensorToken.trim();
        float ppl = String(paramPpl.getValue()).toFloat();
        if (ppl > 0) {
            cfg.pulsesPerLiter = ppl;
        }
        saveDeviceConfig(cfg);
        Serial.println("[CFG] configuração salva na NVS");
    }

    if (conectado) {
        Serial.printf("[WiFi] conectado, IP %s\n", WiFi.localIP().toString().c_str());
        applyDnsServers();
        startNtp();
    } else {
        Serial.println("[WiFi] sem conexão: seguindo offline, nova tentativa a cada 30 s");
        lastWifiAttemptMs = millis();
    }

    pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);
    return conectado;
}

void loop(unsigned long nowMs) {
    if (WiFi.status() == WL_CONNECTED) {
        if (!dnsApplied) {
            applyDnsServers();
        }
        if (!ntpStarted) {
            startNtp();
        }
    } else {
        dnsApplied = false;  // o DHCP reaplica o DNS dele quando reconectar
    }
    if (WiFi.status() != WL_CONNECTED && nowMs - lastWifiAttemptMs >= WIFI_RETRY_INTERVAL_MS) {
        lastWifiAttemptMs = nowMs;
        Serial.println("[WiFi] desconectado, tentando reconectar");
        WiFi.mode(WIFI_STA);
        WiFi.begin();  // reutiliza as credenciais salvas na flash
    }

    // BOOT (GPIO0) segurado por RESET_HOLD_MS: apaga o Wi-Fi salvo e reinicia no portal.
    if (digitalRead(RESET_BUTTON_PIN) == LOW) {
        if (buttonPressedSinceMs == 0) {
            buttonPressedSinceMs = nowMs;
        } else if (nowMs - buttonPressedSinceMs >= RESET_HOLD_MS) {
            Serial.println("[CFG] BOOT segurado: apagando Wi-Fi salvo e reiniciando");
            WiFiManager wm;
            wm.resetSettings();
            ESP.restart();
        }
    } else {
        buttonPressedSinceMs = 0;
    }
}

bool connected() {
    return WiFi.status() == WL_CONNECTED;
}

int64_t nowEpochMs() {
    struct timeval tv;
    gettimeofday(&tv, nullptr);
    int64_t ms = static_cast<int64_t>(tv.tv_sec) * 1000 + tv.tv_usec / 1000;
    return ms >= MIN_VALID_EPOCH_MS ? ms : 0;
}

bool timeSynced() {
    return nowEpochMs() != 0;
}

int postLeitura(const DeviceConfig& cfg, const std::string& json) {
    String url = trimTrailingSlash(cfg.apiUrl) + "/api/leituras";
    HTTPClient http;

    if (url.startsWith("https://")) {
        // Protótipo: aceita qualquer certificado (sem validação da cadeia). Validar
        // o certificado do túnel/nuvem fica para o deploy de demonstração (Sprint 7).
        WiFiClientSecure client;
        client.setInsecure();
        if (!http.begin(client, url)) {
            return -1;
        }
        return enviar(http, cfg, json);
    }

    WiFiClient client;
    if (!http.begin(client, url)) {
        return -1;
    }
    return enviar(http, cfg, json);
}

}  // namespace Network
