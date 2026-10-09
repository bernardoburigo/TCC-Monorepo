package br.unesc.tcc.backend.usuario.dto;

import java.util.List;
import java.util.UUID;

import br.unesc.tcc.backend.usuario.UsuarioRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RegistroRequest(
        @NotBlank String nome,
        @NotBlank @Email String email,
        @NotBlank @Size(min = 8, message = "a senha deve ter ao menos 8 caracteres") String senha,
        @NotNull UsuarioRole role,
        // obrigatório quando role == SINDICO
        String nomeCondominio,
        // obrigatório quando role == PROPRIETARIO
        List<UUID> apartamentoIds) {
}
