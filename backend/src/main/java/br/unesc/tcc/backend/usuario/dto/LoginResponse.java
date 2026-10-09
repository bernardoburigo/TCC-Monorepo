package br.unesc.tcc.backend.usuario.dto;

import br.unesc.tcc.backend.usuario.UsuarioRole;

public record LoginResponse(String token, String tipo, String nome, UsuarioRole role) {

    public LoginResponse(String token, String nome, UsuarioRole role) {
        this(token, "Bearer", nome, role);
    }

}
