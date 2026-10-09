package br.unesc.tcc.backend.alerta;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

// Regra de vazamento provável: fluxo ININTERRUPTO por pelo menos `limiteMinimo`.
//
// Uso normal de água tem pausas (torneira fecha, chuveiro termina); um vazamento
// (boia/descarga com defeito, cano furado) escoa o tempo todo. Logo, se TODAS as janelas de
// leitura até agora tiveram pulsos, sem lacunas, por 30 min ou mais, é anormal.
//
// Lógica pura (sem banco, sem relógio do sistema) para ser testável com dados fabricados.
//
// Limitação conhecida: o YF-S201 mede mal vazões muito baixas (abaixo de ~1 L/min pode haver
// janelas de 5 s sem nenhum pulso mesmo com a água correndo). Um gotejamento lento pode
// "piscar" em zero e quebrar a continuidade — esta regra pega vazamentos francos, não pingos.
public final class DetectorFluxoContinuo {

    public record FluxoContinuo(Instant desde, Instant ate, Duration duracao, double volumeMl) {
    }

    private DetectorFluxoContinuo() {
    }

    // amostras: em ordem cronológica crescente.
    public static Optional<FluxoContinuo> detectar(
            List<Amostra> amostras, Instant agora, Duration limiteMinimo, Duration lacunaMaxima) {
        if (amostras.isEmpty()) {
            return Optional.empty();
        }

        Amostra ultima = amostras.get(amostras.size() - 1);

        // Sensor sem dado recente (offline ou reenviando leituras antigas): não há nada fluindo
        // "agora" que se possa afirmar. O alerta é sobre o presente, não sobre o passado.
        if (Duration.between(ultima.timestamp(), agora).compareTo(lacunaMaxima) > 0) {
            return Optional.empty();
        }
        if (ultima.pulsos() <= 0) {
            return Optional.empty();
        }

        // Sufixo mais longo de janelas com fluxo e sem lacuna entre elas.
        int inicio = amostras.size() - 1;
        while (inicio > 0) {
            Amostra anterior = amostras.get(inicio - 1);
            Amostra atual = amostras.get(inicio);
            boolean quebrou = anterior.pulsos() <= 0
                    || Duration.between(anterior.timestamp(), atual.timestamp()).compareTo(lacunaMaxima) > 0;
            if (quebrou) {
                break;
            }
            inicio--;
        }

        Instant desde = amostras.get(inicio).timestamp();
        Duration duracao = Duration.between(desde, ultima.timestamp());
        if (duracao.compareTo(limiteMinimo) < 0) {
            return Optional.empty();
        }

        double volumeMl = 0;
        for (int i = inicio; i < amostras.size(); i++) {
            volumeMl += amostras.get(i).volumeMl();
        }
        return Optional.of(new FluxoContinuo(desde, ultima.timestamp(), duracao, volumeMl));
    }

}
