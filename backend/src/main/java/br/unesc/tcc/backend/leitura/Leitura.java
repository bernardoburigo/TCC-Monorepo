package br.unesc.tcc.backend.leitura;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;

import br.unesc.tcc.backend.sensor.Sensor;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

// Fisicamente a tabela `leitura` é uma hypertable com PRIMARY KEY(id, timestamp_leitura)
// (exigência do TimescaleDB). Aqui mapeamos só `id` como @Id: o valor gerado é um UUID
// praticamente único, e a aplicação nunca precisa consultar pela chave composta.
@Entity
@Table(name = "leitura")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Leitura {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sensor_id", nullable = false)
    private Sensor sensor;

    @Column(name = "timestamp_leitura", nullable = false)
    private Instant timestampLeitura;

    @Column(nullable = false)
    private long pulsos;

    @Column(name = "volume_ml_estimado", nullable = false)
    private double volumeMlEstimado;

    @Column(nullable = false)
    private long sequencia;

    @CreationTimestamp
    @Column(name = "recebido_em", nullable = false, updatable = false)
    private Instant recebidoEm;

}
