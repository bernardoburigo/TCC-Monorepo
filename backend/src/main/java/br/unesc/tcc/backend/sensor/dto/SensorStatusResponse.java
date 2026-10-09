package br.unesc.tcc.backend.sensor.dto;

import java.time.Instant;
import java.util.UUID;

import br.unesc.tcc.backend.sensor.StatusSensor;

// Estado de um sensor para o app (visão de leitura, sem o token).
// - ultimaLeituraEm: quando o backend RECEBEU a última leitura (base do status)
// - ultimoTimestampLeitura: quando o ESP32 mediu (fim da janela); a diferença entre os
//   dois é a latência de ponta a ponta daquela leitura
public record SensorStatusResponse(
        UUID id,
        UUID apartamentoId,
        String apartamentoNumero,
        String identificador,
        boolean ativo,
        boolean simulado,
        StatusSensor status,
        Instant ultimaLeituraEm,
        Instant ultimoTimestampLeitura) {
}
