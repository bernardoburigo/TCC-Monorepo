package br.unesc.tcc.backend.apartamento.dto;

import java.time.Instant;
import java.util.UUID;

import br.unesc.tcc.backend.apartamento.Apartamento;

public record ApartamentoResponse(
        UUID id,
        UUID condominioId,
        String numero,
        UUID proprietarioId,
        boolean ativo,
        Instant criadoEm) {

    public static ApartamentoResponse de(Apartamento apartamento) {
        return new ApartamentoResponse(
                apartamento.getId(),
                apartamento.getCondominio().getId(),
                apartamento.getNumero(),
                apartamento.getProprietario() != null ? apartamento.getProprietario().getId() : null,
                apartamento.isAtivo(),
                apartamento.getCriadoEm());
    }

}
