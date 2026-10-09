package br.unesc.tcc.backend.condominio.dto;

import jakarta.validation.constraints.NotBlank;

public record CondominioRequest(@NotBlank String nome) {
}
