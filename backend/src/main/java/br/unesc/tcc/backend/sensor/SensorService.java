package br.unesc.tcc.backend.sensor;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.unesc.tcc.backend.apartamento.Apartamento;
import br.unesc.tcc.backend.apartamento.ApartamentoService;
import br.unesc.tcc.backend.common.AcessoNegadoException;
import br.unesc.tcc.backend.common.EntidadeNaoEncontradaException;
import br.unesc.tcc.backend.security.AutenticacaoUtil;
import br.unesc.tcc.backend.sensor.dto.SensorCriadoResponse;
import br.unesc.tcc.backend.sensor.dto.SensorRequest;
import br.unesc.tcc.backend.sensor.dto.SensorResponse;
import br.unesc.tcc.backend.usuario.Usuario;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SensorService {

    private final SensorRepository sensorRepository;
    private final ApartamentoService apartamentoService;

    // @Transactional: SensorResponse.de() acessa sensor.getApartamento(), associação LAZY
    // que precisa de sessão Hibernate aberta (spring.jpa.open-in-view=false).
    @Transactional(readOnly = true)
    public List<SensorResponse> listarPorApartamento(UUID apartamentoId) {
        apartamentoService.buscarApartamentoDoSindico(apartamentoId);
        return sensorRepository.findByApartamentoIdAndAtivoTrue(apartamentoId).stream()
                .map(SensorResponse::de)
                .toList();
    }

    @Transactional(readOnly = true)
    public SensorResponse buscar(UUID id) {
        return SensorResponse.de(buscarSensorDoSindico(id));
    }

    @Transactional
    public SensorCriadoResponse criar(SensorRequest request) {
        Apartamento apartamento = apartamentoService.buscarApartamentoDoSindico(request.apartamentoId());
        Sensor sensor = Sensor.builder()
                .apartamento(apartamento)
                .identificador(request.identificador())
                .token(UUID.randomUUID().toString())
                .simulado(request.ehSimulado())
                .build();
        // saveAndFlush: força o INSERT agora para @CreationTimestamp (criadoEm) já vir
        // preenchido na resposta, em vez de null (o flush normal só ocorreria no commit).
        return SensorCriadoResponse.de(sensorRepository.saveAndFlush(sensor));
    }

    @Transactional
    public SensorResponse atualizar(UUID id, SensorRequest request) {
        Sensor sensor = buscarSensorDoSindico(id);
        if (!sensor.getApartamento().getId().equals(request.apartamentoId())) {
            Apartamento novoApartamento = apartamentoService.buscarApartamentoDoSindico(request.apartamentoId());
            sensor.setApartamento(novoApartamento);
        }
        sensor.setIdentificador(request.identificador());
        if (request.simulado() != null) {
            sensor.setSimulado(request.simulado());
        }
        return SensorResponse.de(sensorRepository.save(sensor));
    }

    @Transactional
    public void excluir(UUID id) {
        Sensor sensor = buscarSensorDoSindico(id);
        sensor.setAtivo(false);
        sensorRepository.save(sensor);
    }

    private Sensor buscarSensorDoSindico(UUID id) {
        Sensor sensor = sensorRepository.findById(id)
                .orElseThrow(() -> new EntidadeNaoEncontradaException("Sensor não encontrado: " + id));

        Usuario sindico = AutenticacaoUtil.usuarioAutenticado();
        if (!sensor.getApartamento().getCondominio().getSindico().getId().equals(sindico.getId())) {
            throw new AcessoNegadoException("Este sensor não pertence a um condomínio do síndico autenticado");
        }

        return sensor;
    }

}
