CREATE TABLE sensor (
    id UUID PRIMARY KEY,
    apartamento_id UUID NOT NULL REFERENCES apartamento(id),
    identificador VARCHAR(100) NOT NULL,
    token VARCHAR(100) NOT NULL UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sensor_apartamento_id ON sensor(apartamento_id);
