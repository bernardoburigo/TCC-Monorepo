package br.unesc.tcc.backend.alerta.dto;

import java.time.Instant;
import java.util.UUID;

import br.unesc.tcc.backend.alerta.TipoAlerta;

// Alerta ATIVO calculado sob demanda a partir das leituras recentes (não há tabela de alertas).
// - desde: início do fluxo contínuo (limitado à janela de busca: 2 x o limite configurado)
// - duracaoSegundos: de `desde` até a última leitura
// - volumeMl: volume escoado nesse período
public record AlertaResponse(
        UUID sensorId,
        UUID apartamentoId,
        String sensorIdentificador,
        TipoAlerta tipo,
        Instant desde,
        long duracaoSegundos,
        double volumeMl,
        boolean simulado) {
}
