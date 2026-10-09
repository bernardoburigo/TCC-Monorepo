package br.unesc.tcc.backend.apartamento;

import java.util.UUID;

import org.springframework.stereotype.Service;

import br.unesc.tcc.backend.common.AcessoNegadoException;
import br.unesc.tcc.backend.common.EntidadeNaoEncontradaException;
import br.unesc.tcc.backend.security.AutenticacaoUtil;
import br.unesc.tcc.backend.usuario.Usuario;
import lombok.RequiredArgsConstructor;

// Regra de leitura de dados de um apartamento (consumo, sensores, leituras, alertas):
// o usuário autenticado precisa ser o síndico do condomínio OU o dono do apartamento.
// (O CRUD de cadastros é outra regra: só o síndico -- ver ApartamentoService.)
//
// Os métodos percorrem associações LAZY (apartamento -> condominio -> sindico,
// apartamento -> proprietario): o chamador precisa estar dentro de @Transactional,
// senão estoura LazyInitializationException (spring.jpa.open-in-view=false).
@Service
@RequiredArgsConstructor
public class AcessoApartamentoService {

    private final ApartamentoRepository apartamentoRepository;

    public Apartamento exigirAcesso(UUID apartamentoId) {
        Apartamento apartamento = apartamentoRepository.findById(apartamentoId)
                .orElseThrow(() -> new EntidadeNaoEncontradaException("Apartamento não encontrado: " + apartamentoId));
        validarAcesso(apartamento);
        return apartamento;
    }

    public void validarAcesso(Apartamento apartamento) {
        Usuario usuario = AutenticacaoUtil.usuarioAutenticado();

        boolean ehSindicoDoCondominio = apartamento.getCondominio().getSindico().getId().equals(usuario.getId());
        boolean ehDonoDoApartamento = apartamento.getProprietario() != null
                && apartamento.getProprietario().getId().equals(usuario.getId());

        if (!ehSindicoDoCondominio && !ehDonoDoApartamento) {
            throw new AcessoNegadoException("Você não tem acesso a este apartamento");
        }
    }

}
