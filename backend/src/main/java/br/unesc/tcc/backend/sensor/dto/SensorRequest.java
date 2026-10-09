package br.unesc.tcc.backend.sensor.dto;

import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

// `simulado` é opcional: ausente = false na criação e "não alterar" na atualização.
public record SensorRequest(
        @NotNull UUID apartamentoId,
        @NotBlank String identificador,
        Boolean simulado) {

    public SensorRequest(UUID apartamentoId, String identificador) {
        this(apartamentoId, identificador, null);
    }

    public boolean ehSimulado() {
        return Boolean.TRUE.equals(simulado);
    }

}
