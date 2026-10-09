package br.unesc.tcc.backend.alerta;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.unesc.tcc.backend.alerta.dto.AlertaResponse;
import br.unesc.tcc.backend.apartamento.AcessoApartamentoService;
import br.unesc.tcc.backend.config.AppProperties;
import br.unesc.tcc.backend.leitura.LeituraRepository;
import br.unesc.tcc.backend.sensor.Sensor;
import br.unesc.tcc.backend.sensor.SensorRepository;
import lombok.RequiredArgsConstructor;

// Calcula, sob demanda, os alertas ATIVOS dos sensores (regra em DetectorFluxoContinuo).
@Service
@RequiredArgsConstructor
public class AlertaService {

    private final SensorRepository sensorRepository;
    private final LeituraRepository leituraRepository;
    private final AcessoApartamentoService acessoApartamentoService;
    private final AppProperties props;
    private final Clock clock;

    // @Transactional: exigirAcesso() e sensor.getApartamento() percorrem associações LAZY.
    @Transactional(readOnly = true)
    public List<AlertaResponse> listarPorApartamento(UUID apartamentoId) {
        acessoApartamentoService.exigirAcesso(apartamentoId);
        return alertasDosSensores(sensorRepository.findByApartamentoIdAndAtivoTrue(apartamentoId));
    }

    // Também usado pelo painel (lista de apartamentos), que passa só os sensores ONLINE.
    // Custo: 1 consulta barata para descartar quem teve pausa recente (a grande maioria em uso
    // normal) e só carrega as leituras dos poucos sensores que ainda são candidatos.
    @Transactional(readOnly = true)
    public List<AlertaResponse> alertasDosSensores(List<Sensor> sensores) {
        if (sensores.isEmpty()) {
            return List.of();
        }

        Instant agora = clock.instant();
        Duration limite = Duration.ofMinutes(props.alerta().fluxoContinuoMinutos());
        Duration lacuna = Duration.ofSeconds(props.alerta().lacunaMaximaSegundos());

        // um zero dentro dos últimos `limite` minutos quebra qualquer fluxo contínuo de `limite`
        Set<UUID> comPausa = new HashSet<>(leituraRepository.sensoresComJanelaSemFluxoDesde(
                sensores.stream().map(Sensor::getId).toList(), agora.minus(limite)));

        List<AlertaResponse> alertas = new ArrayList<>();
        for (Sensor sensor : sensores) {
            if (comPausa.contains(sensor.getId())) {
                continue;
            }
            // busca 2x o limite para reportar quando o fluxo começou (mesmo além do mínimo)
            List<Amostra> amostras = leituraRepository.findAmostrasDesde(sensor.getId(), agora.minus(limite.multipliedBy(2)));

            DetectorFluxoContinuo.detectar(amostras, agora, limite, lacuna).ifPresent(fluxo -> alertas.add(
                    new AlertaResponse(
                            sensor.getId(),
                            sensor.getApartamento().getId(),
                            sensor.getIdentificador(),
                            TipoAlerta.VAZAMENTO_PROVAVEL,
                            fluxo.desde(),
                            fluxo.duracao().toSeconds(),
                            fluxo.volumeMl(),
                            sensor.isSimulado())));
        }
        return alertas;
    }

}
