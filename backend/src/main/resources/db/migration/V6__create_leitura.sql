-- Hypertable de séries temporais (leituras brutas do sensor de fluxo).
-- TimescaleDB exige que PRIMARY KEY/UNIQUE incluam a coluna de particionamento
-- (timestamp_leitura), por isso ela entra tanto na PK quanto na constraint
-- de deduplicação (sensor_id + sequencia + timestamp_leitura).
CREATE TABLE leitura (
    id UUID NOT NULL,
    sensor_id UUID NOT NULL REFERENCES sensor(id),
    timestamp_leitura TIMESTAMPTZ NOT NULL,
    pulsos BIGINT NOT NULL,
    volume_ml_estimado DOUBLE PRECISION NOT NULL,
    sequencia BIGINT NOT NULL,
    recebido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, timestamp_leitura),
    UNIQUE (sensor_id, sequencia, timestamp_leitura)
);

SELECT create_hypertable('leitura', 'timestamp_leitura');

CREATE INDEX idx_leitura_sensor_id_timestamp ON leitura(sensor_id, timestamp_leitura DESC);
