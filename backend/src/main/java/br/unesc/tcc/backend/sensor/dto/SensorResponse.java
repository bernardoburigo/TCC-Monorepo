package br.unesc.tcc.backend.sensor.dto;

import java.time.Instant;
import java.util.UUID;

import br.unesc.tcc.backend.sensor.Sensor;

// Sem o campo `token` -- ele só é exposto uma vez, na resposta de criação (SensorCriadoResponse).
public record SensorResponse(
        UUID id,
        UUID apartamentoId,
        String identificador,
        boolean ativo,
        boolean simulado,
        Instant criadoEm) {

    public static SensorResponse de(Sensor sensor) {
        return new SensorResponse(
                sensor.getId(),
                sensor.getApartamento().getId(),
                sensor.getIdentificador(),
                sensor.isAtivo(),
                sensor.isSimulado(),
                sensor.getCriadoEm());
    }

}
