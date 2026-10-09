package br.unesc.tcc.backend.sensor.dto;

import java.time.Instant;
import java.util.UUID;

import br.unesc.tcc.backend.sensor.Sensor;

// Inclui o token (API key) do sensor -- exibido só nesta resposta de criação.
// Guardar esse valor: ele é usado no header X-Sensor-Token do POST /api/leituras
// e não pode ser recuperado depois.
public record SensorCriadoResponse(
        UUID id,
        UUID apartamentoId,
        String identificador,
        String token,
        boolean ativo,
        boolean simulado,
        Instant criadoEm) {

    public static SensorCriadoResponse de(Sensor sensor) {
        return new SensorCriadoResponse(
                sensor.getId(),
                sensor.getApartamento().getId(),
                sensor.getIdentificador(),
                sensor.getToken(),
                sensor.isAtivo(),
                sensor.isSimulado(),
                sensor.getCriadoEm());
    }

}
