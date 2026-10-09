package br.unesc.tcc.backend.alerta;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import br.unesc.tcc.backend.alerta.DetectorFluxoContinuo.FluxoContinuo;

class DetectorFluxoContinuoTest {

    private static final Instant AGORA = Instant.parse("2026-09-25T12:00:00Z");
    private static final Duration LIMITE = Duration.ofMinutes(30);
    private static final Duration LACUNA = Duration.ofSeconds(15);

    // Leituras de 5 s terminando em `fim`, cobrindo `minutos`, todas com o mesmo número de pulsos.
    private static List<Amostra> janelas(Instant fim, int minutos, long pulsos) {
        List<Amostra> amostras = new ArrayList<>();
        int quantidade = minutos * 12;
        for (int i = quantidade - 1; i >= 0; i--) {
            amostras.add(new Amostra(fim.minusSeconds(5L * i), pulsos, pulsos * 2.2));
        }
        return amostras;
    }

    @Test
    void semLeiturasNaoHaAlerta() {
        assertThat(DetectorFluxoContinuo.detectar(List.of(), AGORA, LIMITE, LACUNA)).isEmpty();
    }

    @Test
    void fluxoContinuoPorMaisDoLimiteGeraAlertaComDuracaoEVolume() {
        List<Amostra> amostras = janelas(AGORA, 40, 3);

        FluxoContinuo fluxo = DetectorFluxoContinuo.detectar(amostras, AGORA, LIMITE, LACUNA).orElseThrow();

        assertThat(fluxo.ate()).isEqualTo(AGORA);
        assertThat(fluxo.desde()).isEqualTo(amostras.get(0).timestamp());
        assertThat(fluxo.duracao()).isGreaterThanOrEqualTo(Duration.ofMinutes(39));
        assertThat(fluxo.volumeMl()).isEqualTo(amostras.size() * 3 * 2.2, org.assertj.core.data.Offset.offset(0.001));
    }

    @Test
    void fluxoContinuoAbaixoDoLimiteNaoAlerta() {
        assertThat(DetectorFluxoContinuo.detectar(janelas(AGORA, 25, 3), AGORA, LIMITE, LACUNA)).isEmpty();
    }

    @Test
    void umaJanelaSemFluxoQuebraAContinuidadeEORelogioRecomecaDepoisDela() {
        // 40 min de fluxo, mas com uma janela sem pulsos há 20 min: só restam 20 min contínuos
        List<Amostra> amostras = janelas(AGORA, 40, 3);
        int indiceDaPausa = amostras.size() - 1 - (20 * 12);
        amostras.set(indiceDaPausa, new Amostra(amostras.get(indiceDaPausa).timestamp(), 0, 0));

        assertThat(DetectorFluxoContinuo.detectar(amostras, AGORA, LIMITE, LACUNA)).isEmpty();
    }

    @Test
    void oFluxoContinuoDepoisDeUmaPausaAindaConta() {
        // pausa há 35 min, depois 35 min de fluxo contínuo até agora => alerta (a pausa antiga não atrapalha)
        List<Amostra> amostras = janelas(AGORA, 40, 3);
        int indiceDaPausa = amostras.size() - 1 - (35 * 12);
        amostras.set(indiceDaPausa, new Amostra(amostras.get(indiceDaPausa).timestamp(), 0, 0));

        FluxoContinuo fluxo = DetectorFluxoContinuo.detectar(amostras, AGORA, LIMITE, LACUNA).orElseThrow();
        assertThat(fluxo.duracao()).isGreaterThanOrEqualTo(Duration.ofMinutes(34));
    }

    @Test
    void lacunaMaiorQueOLimiteEntreLeiturasQuebraAContinuidade() {
        // sensor sem enviar por 60 s no meio (queda de rede): não dá para afirmar que fluiu o tempo todo
        List<Amostra> amostras = new ArrayList<>(janelas(AGORA.minus(Duration.ofMinutes(20)).minusSeconds(60), 20, 3));
        amostras.addAll(janelas(AGORA, 20, 3));

        assertThat(DetectorFluxoContinuo.detectar(amostras, AGORA, LIMITE, LACUNA)).isEmpty();
    }

    @Test
    void sensorSemDadoRecenteNaoAlertaPoisONaoHaNadaAfirmavelAgora() {
        // fluxo contínuo por 40 min, mas a última leitura foi há 5 min (sensor offline)
        List<Amostra> amostras = janelas(AGORA.minus(Duration.ofMinutes(5)), 40, 3);

        assertThat(DetectorFluxoContinuo.detectar(amostras, AGORA, LIMITE, LACUNA)).isEmpty();
    }

    @Test
    void ultimaJanelaSemFluxoDesfazOAlerta() {
        List<Amostra> amostras = janelas(AGORA, 40, 3);
        Amostra ultima = amostras.get(amostras.size() - 1);
        amostras.set(amostras.size() - 1, new Amostra(ultima.timestamp(), 0, 0));

        assertThat(DetectorFluxoContinuo.detectar(amostras, AGORA, LIMITE, LACUNA)).isEmpty();
    }

    @Test
    void leituraUnicaNuncaAlerta() {
        assertThat(DetectorFluxoContinuo.detectar(List.of(new Amostra(AGORA, 5, 11.0)), AGORA, LIMITE, LACUNA)).isEmpty();
    }

}
