package br.unesc.tcc.backend.consumo;

public enum Granularidade {
    MINUTO("minute"),
    HORA("hour"),
    DIA("day");

    private final String unidadeSql;

    Granularidade(String unidadeSql) {
        this.unidadeSql = unidadeSql;
    }

    // valor passado para o date_trunc(...) do Postgres em LeituraRepository
    public String unidadeSql() {
        return unidadeSql;
    }
}
