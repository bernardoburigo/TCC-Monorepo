package br.unesc.tcc.backend.painel.dto;

import java.time.Instant;
import java.util.UUID;

import br.unesc.tcc.backend.sensor.StatusSensor;

// Uma linha da lista de apartamentos do app. Agrega dados de consumo e sensores para o
// app não precisar de N chamadas por apartamento.
//
// - consumoHojeMl: desde 00:00 em app.timezone (calculado aqui, o app não faz conta de fuso)
// - status: agregado dos sensores ativos (um ONLINE basta); SEM_DADOS se não há sensor/leitura
// - ultimaLeituraEm: última leitura RECEBIDA entre os sensores; null se nenhuma
// - simulado: true se QUALQUER sensor do apartamento é simulado (conservador: dado misturado
//   com simulação não deve ser apresentado como 100% real)
// - alertaVazamento: algum sensor ONLINE do apartamento está em fluxo contínuo além do limite
//   (ver alerta/DetectorFluxoContinuo); detalhes em GET /api/apartamentos/{id}/alertas
public record ApartamentoPainelResponse(
        UUID id,
        String numero,
        UUID condominioId,
        String condominioNome,
        double consumoHojeMl,
        int qtdSensores,
        StatusSensor status,
        Instant ultimaLeituraEm,
        boolean simulado,
        boolean alertaVazamento) {
}
