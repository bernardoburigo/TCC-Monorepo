package br.unesc.tcc.backend.leitura.dto;

import java.time.Instant;
import java.util.UUID;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record LeituraRequest(
        @NotNull UUID sensorId,
        @NotNull Instant timestampLeitura,
        @PositiveOrZero long pulsos,
        @PositiveOrZero double volumeMlEstimado,
        @PositiveOrZero long sequencia) {
}
