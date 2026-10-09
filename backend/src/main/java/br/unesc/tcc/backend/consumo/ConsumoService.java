package br.unesc.tcc.backend.consumo;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.unesc.tcc.backend.apartamento.AcessoApartamentoService;
import br.unesc.tcc.backend.apartamento.Apartamento;
import br.unesc.tcc.backend.config.AppProperties;
import br.unesc.tcc.backend.consumo.dto.ConsumoApartamentoResponse;
import br.unesc.tcc.backend.consumo.dto.ConsumoPontoResponse;
import br.unesc.tcc.backend.leitura.LeituraRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ConsumoService {

    private final AcessoApartamentoService acessoApartamentoService;
    private final LeituraRepository leituraRepository;
    private final AppProperties props;
    private final Clock clock;

    // @Transactional: exigirAcesso() percorre associações LAZY (apartamento -> condominio
    // -> sindico, apartamento -> proprietario) que precisam de uma sessão Hibernate aberta;
    // sem isso (e com spring.jpa.open-in-view=false) estoura LazyInitializationException.
    @Transactional(readOnly = true)
    public ConsumoApartamentoResponse consultar(UUID apartamentoId, Instant inicio, Instant fim, Granularidade granularidade) {
        Apartamento apartamento = acessoApartamentoService.exigirAcesso(apartamentoId);

        Granularidade granularidadeEfetiva = granularidade != null ? granularidade : Granularidade.DIA;
        Instant fimEfetivo = fim != null ? fim : clock.instant();
        // O início é alinhado ao começo do intervalo (minuto/hora/dia no fuso da aplicação):
        // "últimos 7 dias" pedido às 19h traria o primeiro dia só das 19h em diante, e o
        // gráfico mostraria uma barra parcial parecendo consumo baixo. Alinhado, todo intervalo
        // (exceto o último, em andamento) vem completo.
        Instant inicioEfetivo = alinharAoInicioDoIntervalo(
                inicio != null ? inicio : fimEfetivo.minus(7, ChronoUnit.DAYS), granularidadeEfetiva);

        List<ConsumoPontoResponse> pontos = leituraRepository
                .agregarConsumoPorApartamento(
                        apartamentoId, inicioEfetivo, fimEfetivo, granularidadeEfetiva.unidadeSql(), props.timezone())
                .stream()
                .map(p -> new ConsumoPontoResponse(p.getPeriodo(), p.getVolumeTotalMl()))
                .toList();

        return new ConsumoApartamentoResponse(
                apartamento.getId(), apartamento.getNumero(), granularidadeEfetiva, inicioEfetivo, fimEfetivo, pontos);
    }

    private Instant alinharAoInicioDoIntervalo(Instant instante, Granularidade granularidade) {
        ChronoUnit unidade = switch (granularidade) {
            case MINUTO -> ChronoUnit.MINUTES;
            case HORA -> ChronoUnit.HOURS;
            case DIA -> ChronoUnit.DAYS;
        };
        // truncatedTo em ZonedDateTime respeita o fuso (00:00 local, não 00:00 UTC)
        return instante.atZone(ZoneId.of(props.timezone())).truncatedTo(unidade).toInstant();
    }

}
