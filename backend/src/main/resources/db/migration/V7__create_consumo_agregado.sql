-- Estrutura pronta para o job @Scheduled de agregação (sprint futura).
-- Sprint 2 consulta o consumo on-the-fly a partir de `leitura`.
CREATE TABLE consumo_agregado (
    id UUID PRIMARY KEY,
    sensor_id UUID NOT NULL REFERENCES sensor(id),
    periodo_inicio TIMESTAMPTZ NOT NULL,
    granularidade VARCHAR(10) NOT NULL,
    volume_total_ml DOUBLE PRECISION NOT NULL,
    calculado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (sensor_id, periodo_inicio, granularidade)
);

CREATE INDEX idx_consumo_agregado_sensor_id ON consumo_agregado(sensor_id);
