package br.unesc.tcc.backend.consumo.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import br.unesc.tcc.backend.consumo.Granularidade;

public record ConsumoApartamentoResponse(
        UUID apartamentoId,
        String numero,
        Granularidade granularidade,
        Instant inicio,
        Instant fim,
        List<ConsumoPontoResponse> pontos) {
}
