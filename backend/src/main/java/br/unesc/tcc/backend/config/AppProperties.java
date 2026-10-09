package br.unesc.tcc.backend.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

// Propriedades próprias da aplicação (prefixo `app.`), sobrescrevíveis por variável
// de ambiente (ex.: APP_TIMEZONE, APP_CORS_ALLOWED_ORIGINS).
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        // Fuso usado para "hoje" e para agrupar consumo por hora/dia. Sem isso o
        // date_trunc usaria o fuso da sessão do banco (UTC no container) e o "dia"
        // viraria às 21h em Criciúma.
        @DefaultValue("America/Sao_Paulo") String timezone,
        @DefaultValue Cors cors,
        @DefaultValue Sensor sensor,
        @DefaultValue Alerta alerta) {

    public record Cors(
            @DefaultValue({"http://localhost:8081", "http://localhost:19006"}) List<String> allowedOrigins) {
    }

    public record Sensor(
            // Sem leitura recebida há mais que isso => OFFLINE (o firmware envia a cada 5 s).
            @DefaultValue("30") int offlineAposSegundos) {
    }

    public record Alerta(
            // Fluxo ininterrupto por pelo menos isto = VAZAMENTO_PROVAVEL: uso normal de água tem
            // pausas; torneira/boia com defeito escoando o tempo todo, não.
            @DefaultValue("30") int fluxoContinuoMinutos,
            // Diferença máxima entre leituras consecutivas para tratá-las como contínuas (o
            // firmware envia a cada 5 s; mais que isso = sensor ficou sem enviar).
            @DefaultValue("15") int lacunaMaximaSegundos) {
    }

}
