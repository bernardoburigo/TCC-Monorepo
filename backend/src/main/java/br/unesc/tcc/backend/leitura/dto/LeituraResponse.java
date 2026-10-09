package br.unesc.tcc.backend.leitura.dto;

import java.time.Instant;
import java.util.UUID;

import br.unesc.tcc.backend.leitura.Leitura;

public record LeituraResponse(
        UUID id,
        UUID sensorId,
        Instant timestampLeitura,
        long pulsos,
        double volumeMlEstimado,
        long sequencia,
        Instant recebidoEm) {

    public static LeituraResponse de(Leitura leitura) {
        return new LeituraResponse(
                leitura.getId(),
                leitura.getSensor().getId(),
                leitura.getTimestampLeitura(),
                leitura.getPulsos(),
                leitura.getVolumeMlEstimado(),
                leitura.getSequencia(),
                leitura.getRecebidoEm());
    }

}
