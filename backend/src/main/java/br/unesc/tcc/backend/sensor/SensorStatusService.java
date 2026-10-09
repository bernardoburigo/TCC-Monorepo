package br.unesc.tcc.backend.sensor;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.unesc.tcc.backend.apartamento.AcessoApartamentoService;
import br.unesc.tcc.backend.common.EntidadeNaoEncontradaException;
import br.unesc.tcc.backend.config.AppProperties;
import br.unesc.tcc.backend.leitura.LeituraRepository;
import br.unesc.tcc.backend.leitura.UltimaLeituraProjection;
import br.unesc.tcc.backend.leitura.dto.LeituraResponse;
import br.unesc.tcc.backend.sensor.dto.SensorStatusResponse;
import lombok.RequiredArgsConstructor;

// Leitura de estado/leituras de sensores para o app (síndico do condomínio OU dono do
// apartamento). O CRUD de sensores (só síndico, com o token) continua em SensorService.
//
// Todos os métodos são @Transactional: percorrem associações LAZY (sensor -> apartamento
// -> condominio -> sindico) e o open-in-view está desligado.
@Service
@RequiredArgsConstructor
public class SensorStatusService {

    static final int MINUTOS_PADRAO = 30;
    static final int MINUTOS_MAXIMO = 240;

    private final SensorRepository sensorRepository;
    private final LeituraRepository leituraRepository;
    private final AcessoApartamentoService acessoApartamentoService;
    private final AppProperties props;
    private final Clock clock;

    @Transactional(readOnly = true)
    public List<SensorStatusResponse> listarPorApartamento(UUID apartamentoId) {
        acessoApartamentoService.exigirAcesso(apartamentoId);
        return montar(sensorRepository.findByApartamentoIdAndAtivoTrue(apartamentoId));
    }

    @Transactional(readOnly = true)
    public SensorStatusResponse buscar(UUID sensorId) {
        return montar(List.of(buscarComAcesso(sensorId))).get(0);
    }

    // Leituras brutas (uma por janela de 5 s) dos últimos `minutos`, em ordem cronológica,
    // para o gráfico "ao vivo". O período é limitado a [1, 240] min (no máximo ~2.900 linhas).
    @Transactional(readOnly = true)
    public List<LeituraResponse> leiturasRecentes(UUID sensorId, Integer minutos) {
        buscarComAcesso(sensorId);

        int minutosEfetivos = minutos == null ? MINUTOS_PADRAO : Math.min(Math.max(minutos, 1), MINUTOS_MAXIMO);
        Instant desde = clock.instant().minus(Duration.ofMinutes(minutosEfetivos));

        return leituraRepository.findRecentesDoSensor(sensorId, desde).stream()
                .map(LeituraResponse::de)
                .toList();
    }

    private Sensor buscarComAcesso(UUID sensorId) {
        Sensor sensor = sensorRepository.findById(sensorId)
                .filter(Sensor::isAtivo)
                .orElseThrow(() -> new EntidadeNaoEncontradaException("Sensor não encontrado: " + sensorId));
        acessoApartamentoService.validarAcesso(sensor.getApartamento());
        return sensor;
    }

    // Uma única consulta traz a última leitura de todos os sensores da lista.
    private List<SensorStatusResponse> montar(List<Sensor> sensores) {
        Map<UUID, UltimaLeituraProjection> ultimaPorSensor = new HashMap<>();
        if (!sensores.isEmpty()) {
            List<UUID> ids = sensores.stream().map(Sensor::getId).toList();
            for (UltimaLeituraProjection ultima : leituraRepository.ultimasLeiturasPorSensor(ids)) {
                ultimaPorSensor.put(ultima.getSensorId(), ultima);
            }
        }

        Instant agora = clock.instant();
        Duration limiteOffline = Duration.ofSeconds(props.sensor().offlineAposSegundos());

        return sensores.stream()
                .map(sensor -> {
                    UltimaLeituraProjection ultima = ultimaPorSensor.get(sensor.getId());
                    Instant recebidoEm = ultima != null ? ultima.getRecebidoEm() : null;
                    return new SensorStatusResponse(
                            sensor.getId(),
                            sensor.getApartamento().getId(),
                            sensor.getApartamento().getNumero(),
                            sensor.getIdentificador(),
                            sensor.isAtivo(),
                            sensor.isSimulado(),
                            StatusSensor.de(recebidoEm, agora, limiteOffline),
                            recebidoEm,
                            ultima != null ? ultima.getTimestampLeitura() : null);
                })
                .toList();
    }

}
