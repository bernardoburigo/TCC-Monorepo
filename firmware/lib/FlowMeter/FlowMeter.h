#pragma once

// Lógica pura de conversão pulsos -> vazão/volume, sem depender de
// Arduino.h, para poder ser testada nativamente (env:native) sem hardware.

struct FlowReading {
    double flowLPerMin;
    double volumeMl;
};

// pulseCount: pulsos contados no intervalo
// intervalMs: duração do intervalo, em milissegundos
// pulsesPerLiter: constante de calibração do sensor (pulsos por litro)
FlowReading calculateFlow(unsigned long pulseCount, unsigned long intervalMs, float pulsesPerLiter);
