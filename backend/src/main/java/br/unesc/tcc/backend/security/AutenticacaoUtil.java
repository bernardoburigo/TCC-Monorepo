package br.unesc.tcc.backend.security;

import org.springframework.security.core.context.SecurityContextHolder;

import br.unesc.tcc.backend.usuario.Usuario;

public final class AutenticacaoUtil {

    private AutenticacaoUtil() {
    }

    public static Usuario usuarioAutenticado() {
        return (Usuario) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

}
