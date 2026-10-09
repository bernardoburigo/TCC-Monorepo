package br.unesc.tcc.backend.apartamento;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.unesc.tcc.backend.apartamento.dto.ApartamentoRequest;
import br.unesc.tcc.backend.apartamento.dto.ApartamentoResponse;
import br.unesc.tcc.backend.common.AcessoNegadoException;
import br.unesc.tcc.backend.common.EntidadeNaoEncontradaException;
import br.unesc.tcc.backend.condominio.Condominio;
import br.unesc.tcc.backend.condominio.CondominioService;
import br.unesc.tcc.backend.security.AutenticacaoUtil;
import br.unesc.tcc.backend.usuario.Usuario;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ApartamentoService {

    private final ApartamentoRepository apartamentoRepository;
    private final CondominioService condominioService;

    // @Transactional: ApartamentoResponse.de() acessa apartamento.getCondominio(), associação
    // LAZY que precisa de sessão Hibernate aberta (spring.jpa.open-in-view=false).
    @Transactional(readOnly = true)
    public List<ApartamentoResponse> listarPorCondominio(UUID condominioId) {
        condominioService.buscarCondominioDoSindico(condominioId);
        return apartamentoRepository.findByCondominioIdAndAtivoTrue(condominioId).stream()
                .map(ApartamentoResponse::de)
                .toList();
    }

    @Transactional(readOnly = true)
    public ApartamentoResponse buscar(UUID id) {
        return ApartamentoResponse.de(buscarApartamentoDoSindico(id));
    }

    @Transactional
    public ApartamentoResponse criar(ApartamentoRequest request) {
        Condominio condominio = condominioService.buscarCondominioDoSindico(request.condominioId());
        Apartamento apartamento = Apartamento.builder()
                .condominio(condominio)
                .numero(request.numero())
                .build();
        // saveAndFlush: força o INSERT agora para @CreationTimestamp (criadoEm) já vir
        // preenchido na resposta, em vez de null (o flush normal só ocorreria no commit).
        return ApartamentoResponse.de(apartamentoRepository.saveAndFlush(apartamento));
    }

    @Transactional
    public ApartamentoResponse atualizar(UUID id, ApartamentoRequest request) {
        Apartamento apartamento = buscarApartamentoDoSindico(id);
        if (!apartamento.getCondominio().getId().equals(request.condominioId())) {
            // garante que o novo condomínio também pertence ao síndico autenticado
            Condominio novoCondominio = condominioService.buscarCondominioDoSindico(request.condominioId());
            apartamento.setCondominio(novoCondominio);
        }
        apartamento.setNumero(request.numero());
        return ApartamentoResponse.de(apartamentoRepository.save(apartamento));
    }

    @Transactional
    public void excluir(UUID id) {
        Apartamento apartamento = buscarApartamentoDoSindico(id);
        apartamento.setAtivo(false);
        apartamentoRepository.save(apartamento);
    }

    public Apartamento buscarApartamentoDoSindico(UUID id) {
        Apartamento apartamento = apartamentoRepository.findById(id)
                .orElseThrow(() -> new EntidadeNaoEncontradaException("Apartamento não encontrado: " + id));

        Usuario sindico = AutenticacaoUtil.usuarioAutenticado();
        if (!apartamento.getCondominio().getSindico().getId().equals(sindico.getId())) {
            throw new AcessoNegadoException("Este apartamento não pertence a um condomínio do síndico autenticado");
        }

        return apartamento;
    }

}
