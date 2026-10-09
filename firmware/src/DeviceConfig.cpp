#include "DeviceConfig.h"

#include <Preferences.h>

#include "config.h"

// Chaves da NVS têm no máximo 15 caracteres.
static const char* NVS_NAMESPACE = "tcc";

void loadDeviceConfig(DeviceConfig& cfg) {
    Preferences prefs;
    // read-write mesmo só lendo: abrir um namespace inexistente em modo somente
    // leitura falha e polui o Serial na primeira execução.
    prefs.begin(NVS_NAMESPACE, false);
    cfg.apiUrl = prefs.getString("apiUrl", DEFAULT_API_URL);
    cfg.sensorId = prefs.getString("sensorId", "");
    cfg.sensorToken = prefs.getString("token", "");
    cfg.pulsesPerLiter = prefs.getFloat("ppl", PULSES_PER_LITER);
    prefs.end();
}

void saveDeviceConfig(const DeviceConfig& cfg) {
    Preferences prefs;
    prefs.begin(NVS_NAMESPACE, false);
    prefs.putString("apiUrl", cfg.apiUrl);
    prefs.putString("sensorId", cfg.sensorId);
    prefs.putString("token", cfg.sensorToken);
    prefs.putFloat("ppl", cfg.pulsesPerLiter);
    prefs.end();
}

bool isConfigured(const DeviceConfig& cfg) {
    return cfg.apiUrl.length() > 0 && cfg.sensorId.length() > 0 && cfg.sensorToken.length() > 0;
}
