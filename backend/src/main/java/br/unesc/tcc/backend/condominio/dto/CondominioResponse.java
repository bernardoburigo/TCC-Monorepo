package br.unesc.tcc.backend.condominio.dto;

import java.time.Instant;
import java.util.UUID;

import br.unesc.tcc.backend.condominio.Condominio;

public record CondominioResponse(UUID id, String nome, boolean ativo, Instant criadoEm) {

    public static CondominioResponse de(Condominio condominio) {
        return new CondominioResponse(condominio.getId(), condominio.getNome(), condominio.isAtivo(), condominio.getCriadoEm());
    }

}
