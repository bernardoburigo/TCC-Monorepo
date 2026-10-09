package br.unesc.tcc.backend.common;

import java.util.List;

public record ErrorResponse(String mensagem, List<String> detalhes) {

    public ErrorResponse(String mensagem) {
        this(mensagem, List.of());
    }

}
