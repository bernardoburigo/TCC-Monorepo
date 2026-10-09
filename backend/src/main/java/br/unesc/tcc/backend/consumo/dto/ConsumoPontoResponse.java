package br.unesc.tcc.backend.consumo.dto;

import java.time.Instant;

public record ConsumoPontoResponse(Instant periodo, double volumeTotalMl) {
}
