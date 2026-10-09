CREATE TABLE apartamento (
    id UUID PRIMARY KEY,
    condominio_id UUID NOT NULL REFERENCES condominio(id),
    numero VARCHAR(50) NOT NULL,
    proprietario_id UUID REFERENCES usuario(id),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (condominio_id, numero)
);

CREATE INDEX idx_apartamento_condominio_id ON apartamento(condominio_id);
CREATE INDEX idx_apartamento_proprietario_id ON apartamento(proprietario_id);
