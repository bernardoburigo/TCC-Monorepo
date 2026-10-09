CREATE TABLE condominio (
    id UUID PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    sindico_id UUID NOT NULL REFERENCES usuario(id),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_condominio_sindico_id ON condominio(sindico_id);
