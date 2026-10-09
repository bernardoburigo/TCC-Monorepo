package br.unesc.tcc.backend.consumo;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;

import br.unesc.tcc.backend.sensor.Sensor;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// Estrutura pronta para o job @Scheduled de materialização (sprint futura).
// O Sprint 2 não escreve nem lê desta tabela; GET /consumo calcula on-the-fly
// a partir de `leitura` (ver LeituraRepository.agregarConsumoPorApartamento).
@Entity
@Table(name = "consumo_agregado")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsumoAgregado {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sensor_id", nullable = false)
    private Sensor sensor;

    @Column(name = "periodo_inicio", nullable = false)
    private Instant periodoInicio;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Granularidade granularidade;

    @Column(name = "volume_total_ml", nullable = false)
    private double volumeTotalMl;

    @CreationTimestamp
    @Column(name = "calculado_em", nullable = false, updatable = false)
    private Instant calculadoEm;

}
