#include <Arduino.h>

#include "config.h"
#include "DeviceConfig.h"
#include "FlowMeter.h"
#include "LeituraPayload.h"
#include "Network.h"
#include "SendPolicy.h"
#include "SendQueue.h"

volatile unsigned long pulseCount = 0;

DeviceConfig deviceConfig;
SendQueue<Leitura, QUEUE_CAPACITY> sendQueue;

// Janela de amostragem (1 s): alimenta o Serial, como na Sprint 1.
unsigned long lastSampleMs = 0;
// Volume acumulado desde o boot: SÓ para o Serial/calibração. Nunca é enviado —
// o backend soma volume_ml_estimado, então cada leitura carrega apenas o delta da janela.
double totalVolumeMl = 0.0;

// Janela de envio (POST_WINDOW_MS): soma os pulsos de várias amostras.
unsigned long postWindowStartMs = 0;
uint32_t postWindowPulses = 0;
uint32_t nextSequence = 0;

// Estado do reenvio da frente da fila.
uint32_t sendAttempt = 0;
unsigned long nextSendAttemptMs = 0;

void IRAM_ATTR onPulse() {
    pulseCount++;
}

// Fecha a janela de envio: vira uma Leitura na fila. Só fecha com hora válida
// (NTP); até lá os pulsos continuam acumulando na janela em vez de se perderem,
// então o consumo é preservado (só a resolução temporal fica grosseira).
void closePostWindowIfDue(unsigned long now) {
    if (now - postWindowStartMs < POST_WINDOW_MS) {
        return;
    }
    if (!Network::timeSynced()) {
        return;
    }

    FlowReading window = calculateFlow(postWindowPulses, now - postWindowStartMs, deviceConfig.pulsesPerLiter);
    Leitura leitura = {Network::nowEpochMs(), postWindowPulses, window.volumeMl, nextSequence++};
    if (sendQueue.push(leitura)) {
        Serial.printf("[FILA] cheia: leitura mais antiga descartada (total descartadas=%lu)\n",
                      static_cast<unsigned long>(sendQueue.droppedCount()));
    }

    postWindowStartMs = now;
    postWindowPulses = 0;
}

void sampleOnce(unsigned long now) {
    noInterrupts();
    unsigned long pulses = pulseCount;
    pulseCount = 0;
    interrupts();

    unsigned long elapsedMs = now - lastSampleMs;
    lastSampleMs = now;

    FlowReading reading = calculateFlow(pulses, elapsedMs, deviceConfig.pulsesPerLiter);
    totalVolumeMl += reading.volumeMl;
    postWindowPulses += pulses;

    Serial.printf(
        "pulsos=%lu vazao=%.2f L/min volume_intervalo=%.2f mL volume_total=%.2f mL | fila=%u wifi=%s hora=%s\n",
        pulses, reading.flowLPerMin, reading.volumeMl, totalVolumeMl,
        static_cast<unsigned>(sendQueue.size()),
        Network::connected() ? "ok" : "--",
        Network::timeSynced() ? "ok" : "--");

    closePostWindowIfDue(now);
}

// No máximo UM POST por chamada: o loop volta a amostrar entre os envios e um
// backlog grande se esvazia rápido sem atrasar a medição (os pulsos seguem sendo
// contados pela ISR mesmo durante um POST bloqueante).
void drainSendQueue() {
    unsigned long now = millis();
    if (sendQueue.empty() || !Network::connected() || !isConfigured(deviceConfig)) {
        return;
    }
    if (static_cast<long>(now - nextSendAttemptMs) < 0) {
        return;
    }

    Leitura leitura;
    sendQueue.peek(leitura);
    int status = Network::postLeitura(deviceConfig, buildLeituraJson(deviceConfig.sensorId.c_str(), leitura));

    switch (classifyHttpStatus(status)) {
        case SendOutcome::Sent:
            Serial.printf("[POST] seq=%lu -> %d (fila=%u)\n", static_cast<unsigned long>(leitura.sequencia), status,
                          static_cast<unsigned>(sendQueue.size() - 1));
            sendQueue.pop();
            sendAttempt = 0;
            break;
        case SendOutcome::Drop:
            Serial.printf("[POST] seq=%lu -> %d: payload rejeitado pelo backend, descartando\n",
                          static_cast<unsigned long>(leitura.sequencia), status);
            sendQueue.pop();
            sendAttempt = 0;
            break;
        case SendOutcome::AuthError:
            Serial.printf("[POST] seq=%lu -> %d: TOKEN/sensorId INVÁLIDO. Reconfigure pelo portal (BOOT 3 s). Nova tentativa em %lu s\n",
                          static_cast<unsigned long>(leitura.sequencia), status,
                          static_cast<unsigned long>(BACKOFF_MAX_MS / 1000));
            nextSendAttemptMs = millis() + BACKOFF_MAX_MS;
            break;
        case SendOutcome::Retry: {
            uint32_t waitMs = nextBackoffMs(sendAttempt++, BACKOFF_BASE_MS, BACKOFF_MAX_MS);
            Serial.printf("[POST] seq=%lu -> falha (%d), mantida na fila (fila=%u). Nova tentativa em %lu s\n",
                          static_cast<unsigned long>(leitura.sequencia), status,
                          static_cast<unsigned>(sendQueue.size()), static_cast<unsigned long>(waitMs / 1000));
            nextSendAttemptMs = millis() + waitMs;
            break;
        }
    }
}

void setup() {
    Serial.begin(115200);
    pinMode(SENSOR_PULSE_PIN, INPUT_PULLUP);
    // A contagem de pulsos começa antes do Wi-Fi: a ISR independe da rede.
    attachInterrupt(digitalPinToInterrupt(SENSOR_PULSE_PIN), onPulse, FALLING);

    Serial.println("Sprint 3 - firmware YF-S201 (Wi-Fi + NTP + POST periodico para a API)");

    loadDeviceConfig(deviceConfig);
    Network::begin(deviceConfig);

    if (!isConfigured(deviceConfig)) {
        Serial.println("[CFG] sem sensorId/token: leituras NAO serao enviadas. Segure BOOT por 3 s para abrir o portal.");
    }
    Serial.printf("[CFG] api=%s sensorId=%s pulsos/litro=%.2f\n", deviceConfig.apiUrl.c_str(),
                  deviceConfig.sensorId.c_str(), deviceConfig.pulsesPerLiter);

    // A conexão/portal pode ter bloqueado por vários segundos: recomeça as janelas
    // do zero para a primeira leitura não misturar esse tempo.
    noInterrupts();
    pulseCount = 0;
    interrupts();
    lastSampleMs = millis();
    postWindowStartMs = lastSampleMs;
}

void loop() {
    unsigned long now = millis();
    Network::loop(now);

    if (now - lastSampleMs >= SAMPLE_INTERVAL_MS) {
        sampleOnce(now);
    }

    drainSendQueue();
}
