package br.unesc.tcc.backend.leitura;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import br.unesc.tcc.backend.alerta.Amostra;

public interface LeituraRepository extends JpaRepository<Leitura, UUID> {

    // granularidade é validada no service (só aceita valores do enum Granularidade) antes
    // de chegar aqui. date_trunc com 3 argumentos trunca NO FUSO informado (e devolve
    // timestamptz): "dia" = dia civil de America/Sao_Paulo, não o dia UTC.
    @Query(value = """
            SELECT date_trunc(:granularidade, l.timestamp_leitura, :fuso) AS periodo,
                   SUM(l.volume_ml_estimado) AS volumeTotalMl
            FROM leitura l
            JOIN sensor s ON s.id = l.sensor_id
            WHERE s.apartamento_id = :apartamentoId
              AND l.timestamp_leitura >= :inicio
              AND l.timestamp_leitura < :fim
            GROUP BY periodo
            ORDER BY periodo
            """, nativeQuery = true)
    List<ConsumoPontoProjection> agregarConsumoPorApartamento(
            @Param("apartamentoId") UUID apartamentoId,
            @Param("inicio") Instant inicio,
            @Param("fim") Instant fim,
            @Param("granularidade") String granularidade,
            @Param("fuso") String fuso);

    // Consumo desde `inicio` de VÁRIOS apartamentos numa só consulta (evita N+1 no painel).
    // Apartamentos sem leitura no período simplesmente não aparecem no resultado.
    @Query(value = """
            SELECT s.apartamento_id AS apartamentoId,
                   SUM(l.volume_ml_estimado) AS volumeTotalMl
            FROM leitura l
            JOIN sensor s ON s.id = l.sensor_id
            WHERE s.apartamento_id IN (:apartamentoIds)
              AND l.timestamp_leitura >= :inicio
            GROUP BY s.apartamento_id
            """, nativeQuery = true)
    List<ConsumoApartamentoProjection> somarConsumoDesde(
            @Param("apartamentoIds") Collection<UUID> apartamentoIds,
            @Param("inicio") Instant inicio);

    // Última leitura de cada sensor. LATERAL + ORDER BY ... LIMIT 1 usa o índice
    // (sensor_id, timestamp_leitura DESC) e lê 1 linha por sensor, em vez de varrer a
    // hypertable inteira com MAX(). Sensores sem nenhuma leitura ficam de fora.
    @Query(value = """
            SELECT s.id AS sensorId,
                   ult.recebido_em AS recebidoEm,
                   ult.timestamp_leitura AS timestampLeitura
            FROM sensor s
            JOIN LATERAL (
                SELECT l.recebido_em, l.timestamp_leitura
                FROM leitura l
                WHERE l.sensor_id = s.id
                ORDER BY l.timestamp_leitura DESC
                LIMIT 1
            ) ult ON TRUE
            WHERE s.id IN (:sensorIds)
            """, nativeQuery = true)
    List<UltimaLeituraProjection> ultimasLeiturasPorSensor(@Param("sensorIds") Collection<UUID> sensorIds);

    @Query("""
            SELECT l FROM Leitura l
            WHERE l.sensor.id = :sensorId AND l.timestampLeitura >= :desde
            ORDER BY l.timestampLeitura ASC
            """)
    List<Leitura> findRecentesDoSensor(@Param("sensorId") UUID sensorId, @Param("desde") Instant desde);

    // Sensores que tiveram alguma janela SEM fluxo desde `desde`: esses não podem estar em
    // fluxo contínuo por esse tempo. Filtro barato antes de carregar as leituras de cada sensor.
    @Query("""
            SELECT DISTINCT l.sensor.id FROM Leitura l
            WHERE l.sensor.id IN :sensorIds AND l.timestampLeitura >= :desde AND l.pulsos = 0
            """)
    List<UUID> sensoresComJanelaSemFluxoDesde(@Param("sensorIds") Collection<UUID> sensorIds, @Param("desde") Instant desde);

    @Query("""
            SELECT new br.unesc.tcc.backend.alerta.Amostra(l.timestampLeitura, l.pulsos, l.volumeMlEstimado)
            FROM Leitura l
            WHERE l.sensor.id = :sensorId AND l.timestampLeitura >= :desde
            ORDER BY l.timestampLeitura ASC
            """)
    List<Amostra> findAmostrasDesde(@Param("sensorId") UUID sensorId, @Param("desde") Instant desde);

}
