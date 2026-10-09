package br.unesc.tcc.backend.painel;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.unesc.tcc.backend.alerta.AlertaService;
import br.unesc.tcc.backend.alerta.dto.AlertaResponse;
import br.unesc.tcc.backend.apartamento.Apartamento;
import br.unesc.tcc.backend.apartamento.ApartamentoRepository;
import br.unesc.tcc.backend.condominio.Condominio;
import br.unesc.tcc.backend.condominio.CondominioRepository;
import br.unesc.tcc.backend.config.AppProperties;
import br.unesc.tcc.backend.leitura.ConsumoApartamentoProjection;
import br.unesc.tcc.backend.leitura.LeituraRepository;
import br.unesc.tcc.backend.leitura.UltimaLeituraProjection;
import br.unesc.tcc.backend.painel.dto.ApartamentoPainelResponse;
import br.unesc.tcc.backend.security.AutenticacaoUtil;
import br.unesc.tcc.backend.sensor.Sensor;
import br.unesc.tcc.backend.sensor.SensorRepository;
import br.unesc.tcc.backend.sensor.StatusSensor;
import br.unesc.tcc.backend.usuario.Usuario;
import br.unesc.tcc.backend.usuario.UsuarioRole;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PainelService {

    private final CondominioRepository condominioRepository;
    private final ApartamentoRepository apartamentoRepository;
    private final SensorRepository sensorRepository;
    private final LeituraRepository leituraRepository;
    private final AlertaService alertaService;
    private final AppProperties props;
    private final Clock clock;

    // Visão por papel: SINDICO vê todos os apartamentos ativos dos seus condomínios;
    // PROPRIETARIO vê só os que possui. Total de consultas fixo (não cresce com o número de
    // apartamentos): apartamentos, sensores, consumo de hoje e última leitura por sensor.
    //
    // @Transactional: sensor.getApartamento() é LAZY (open-in-view=false).
    @Transactional(readOnly = true)
    public List<ApartamentoPainelResponse> listarMeusApartamentos() {
        Usuario usuario = AutenticacaoUtil.usuarioAutenticado();

        List<Apartamento> apartamentos = usuario.getRole() == UsuarioRole.SINDICO
                ? apartamentosDoSindico(usuario)
                : apartamentoRepository.findAtivosComCondominioDoProprietario(usuario.getId());
        if (apartamentos.isEmpty()) {
            return List.of();
        }

        List<UUID> apartamentoIds = apartamentos.stream().map(Apartamento::getId).toList();
        Instant agora = clock.instant();

        Map<UUID, List<Sensor>> sensoresPorApartamento = new HashMap<>();
        List<Sensor> sensores = sensorRepository.findByApartamentoIdInAndAtivoTrue(apartamentoIds);
        for (Sensor sensor : sensores) {
            sensoresPorApartamento.computeIfAbsent(sensor.getApartamento().getId(), k -> new ArrayList<>()).add(sensor);
        }

        Map<UUID, UltimaLeituraProjection> ultimaPorSensor = new HashMap<>();
        if (!sensores.isEmpty()) {
            List<UUID> sensorIds = sensores.stream().map(Sensor::getId).toList();
            for (UltimaLeituraProjection ultima : leituraRepository.ultimasLeiturasPorSensor(sensorIds)) {
                ultimaPorSensor.put(ultima.getSensorId(), ultima);
            }
        }

        Map<UUID, Double> consumoHoje = new HashMap<>();
        for (ConsumoApartamentoProjection c : leituraRepository.somarConsumoDesde(apartamentoIds, inicioDeHoje(agora))) {
            consumoHoje.put(c.getApartamentoId(), c.getVolumeTotalMl());
        }

        Duration limiteOffline = Duration.ofSeconds(props.sensor().offlineAposSegundos());

        // status de cada sensor e última leitura recebida (uma vez só; usado abaixo)
        Map<UUID, StatusSensor> statusPorSensor = new HashMap<>();
        for (Sensor sensor : sensores) {
            UltimaLeituraProjection ultima = ultimaPorSensor.get(sensor.getId());
            statusPorSensor.put(sensor.getId(),
                    StatusSensor.de(ultima != null ? ultima.getRecebidoEm() : null, agora, limiteOffline));
        }

        // Só sensor ONLINE pode estar em fluxo contínuo "agora". Custo baixo: uma consulta
        // descarta quem teve pausa recente, e só o restante tem as leituras carregadas.
        List<Sensor> sensoresOnline = sensores.stream()
                .filter(sensor -> statusPorSensor.get(sensor.getId()) == StatusSensor.ONLINE)
                .toList();
        Set<UUID> apartamentosComAlerta = alertaService.alertasDosSensores(sensoresOnline).stream()
                .map(AlertaResponse::apartamentoId)
                .collect(Collectors.toSet());

        return apartamentos.stream()
                .map(apartamento -> {
                    List<Sensor> doApartamento = sensoresPorApartamento.getOrDefault(apartamento.getId(), List.of());

                    List<StatusSensor> statusDosSensores = new ArrayList<>();
                    Instant ultimaLeituraEm = null;
                    for (Sensor sensor : doApartamento) {
                        statusDosSensores.add(statusPorSensor.get(sensor.getId()));
                        UltimaLeituraProjection ultima = ultimaPorSensor.get(sensor.getId());
                        Instant recebidoEm = ultima != null ? ultima.getRecebidoEm() : null;
                        if (recebidoEm != null && (ultimaLeituraEm == null || recebidoEm.isAfter(ultimaLeituraEm))) {
                            ultimaLeituraEm = recebidoEm;
                        }
                    }

                    return new ApartamentoPainelResponse(
                            apartamento.getId(),
                            apartamento.getNumero(),
                            apartamento.getCondominio().getId(),
                            apartamento.getCondominio().getNome(),
                            consumoHoje.getOrDefault(apartamento.getId(), 0.0),
                            doApartamento.size(),
                            StatusSensor.agregar(statusDosSensores),
                            ultimaLeituraEm,
                            doApartamento.stream().anyMatch(Sensor::isSimulado),
                            apartamentosComAlerta.contains(apartamento.getId()));
                })
                .sorted(Comparator.comparing(ApartamentoPainelResponse::condominioNome)
                        .thenComparing(ApartamentoPainelResponse::numero))
                .toList();
    }

    private List<Apartamento> apartamentosDoSindico(Usuario sindico) {
        List<UUID> condominioIds = condominioRepository.findBySindicoIdAndAtivoTrue(sindico.getId()).stream()
                .map(Condominio::getId)
                .toList();
        if (condominioIds.isEmpty()) {
            return List.of();
        }
        return apartamentoRepository.findAtivosComCondominioPorCondominios(condominioIds);
    }

    // 00:00 do dia corrente no fuso da aplicação (não o do servidor nem o do navegador).
    private Instant inicioDeHoje(Instant agora) {
        ZoneId zona = ZoneId.of(props.timezone());
        return agora.atZone(zona).toLocalDate().atStartOfDay(zona).toInstant();
    }

}
