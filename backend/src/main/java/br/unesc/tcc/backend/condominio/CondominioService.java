package br.unesc.tcc.backend.condominio;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.unesc.tcc.backend.common.AcessoNegadoException;
import br.unesc.tcc.backend.common.EntidadeNaoEncontradaException;
import br.unesc.tcc.backend.condominio.dto.CondominioRequest;
import br.unesc.tcc.backend.condominio.dto.CondominioResponse;
import br.unesc.tcc.backend.security.AutenticacaoUtil;
import br.unesc.tcc.backend.usuario.Usuario;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CondominioService {

    private final CondominioRepository condominioRepository;

    public List<CondominioResponse> listarMeus() {
        Usuario sindico = AutenticacaoUtil.usuarioAutenticado();
        return condominioRepository.findBySindicoIdAndAtivoTrue(sindico.getId()).stream()
                .map(CondominioResponse::de)
                .toList();
    }

    // @Transactional: buscarCondominioDoSindico() acessa condominio.getSindico(), associação
    // LAZY que precisa de sessão Hibernate aberta (spring.jpa.open-in-view=false).
    @Transactional(readOnly = true)
    public CondominioResponse buscar(UUID id) {
        return CondominioResponse.de(buscarCondominioDoSindico(id));
    }

    @Transactional
    public CondominioResponse criar(CondominioRequest request) {
        Usuario sindico = AutenticacaoUtil.usuarioAutenticado();
        Condominio condominio = Condominio.builder()
                .nome(request.nome())
                .sindico(sindico)
                .build();
        // saveAndFlush: força o INSERT agora para @CreationTimestamp (criadoEm) já vir
        // preenchido na resposta, em vez de null (o flush normal só ocorreria no commit).
        return CondominioResponse.de(condominioRepository.saveAndFlush(condominio));
    }

    @Transactional
    public CondominioResponse atualizar(UUID id, CondominioRequest request) {
        Condominio condominio = buscarCondominioDoSindico(id);
        condominio.setNome(request.nome());
        return CondominioResponse.de(condominioRepository.save(condominio));
    }

    @Transactional
    public void excluir(UUID id) {
        Condominio condominio = buscarCondominioDoSindico(id);
        condominio.setAtivo(false);
        condominioRepository.save(condominio);
    }

    public Condominio buscarCondominioDoSindico(UUID id) {
        Condominio condominio = condominioRepository.findById(id)
                .orElseThrow(() -> new EntidadeNaoEncontradaException("Condomínio não encontrado: " + id));

        Usuario sindico = AutenticacaoUtil.usuarioAutenticado();
        if (!condominio.getSindico().getId().equals(sindico.getId())) {
            throw new AcessoNegadoException("Este condomínio não pertence ao síndico autenticado");
        }

        return condominio;
    }

}
