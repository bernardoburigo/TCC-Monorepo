package br.unesc.tcc.backend.usuario.dto;

import java.util.UUID;

import br.unesc.tcc.backend.usuario.Usuario;
import br.unesc.tcc.backend.usuario.UsuarioRole;

public record UsuarioResponse(UUID id, String nome, String email, UsuarioRole role) {

    public static UsuarioResponse de(Usuario usuario) {
        return new UsuarioResponse(usuario.getId(), usuario.getNome(), usuario.getEmail(), usuario.getRole());
    }

}
