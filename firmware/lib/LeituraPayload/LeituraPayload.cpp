#include "LeituraPayload.h"

#include <cstdio>
#include <ctime>

#include <ArduinoJson.h>

std::string formatIso8601(int64_t epochMs) {
    // divisão com piso: mantém os milissegundos em [0, 999] mesmo para epoch negativo
    int64_t secs = epochMs / 1000;
    int64_t ms = epochMs % 1000;
    if (ms < 0) {
        ms += 1000;
        secs -= 1;
    }

    time_t t = static_cast<time_t>(secs);
    struct tm parts;
    gmtime_r(&t, &parts);

    char buf[32];
    snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02d.%03dZ",
             parts.tm_year + 1900, parts.tm_mon + 1, parts.tm_mday,
             parts.tm_hour, parts.tm_min, parts.tm_sec, static_cast<int>(ms));
    return std::string(buf);
}

std::string buildLeituraJson(const char* sensorId, const Leitura& leitura) {
    JsonDocument doc;
    doc["sensorId"] = sensorId;
    doc["timestampLeitura"] = formatIso8601(leitura.timestampMs);
    doc["pulsos"] = leitura.pulsos;
    doc["volumeMlEstimado"] = leitura.volumeMl;
    doc["sequencia"] = leitura.sequencia;

    std::string json;
    serializeJson(doc, json);
    return json;
}
