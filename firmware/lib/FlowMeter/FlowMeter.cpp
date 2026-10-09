#include "FlowMeter.h"

FlowReading calculateFlow(unsigned long pulseCount, unsigned long intervalMs, float pulsesPerLiter) {
    if (intervalMs == 0 || pulsesPerLiter <= 0) {
        return {0.0, 0.0};
    }

    double liters = static_cast<double>(pulseCount) / pulsesPerLiter;
    double intervalMinutes = static_cast<double>(intervalMs) / 60000.0;

    FlowReading reading;
    reading.flowLPerMin = liters / intervalMinutes;
    reading.volumeMl = liters * 1000.0;
    return reading;
}
