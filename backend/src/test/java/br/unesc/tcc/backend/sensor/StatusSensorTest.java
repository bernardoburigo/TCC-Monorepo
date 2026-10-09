package br.unesc.tcc.backend.sensor;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

class StatusSensorTest {

    private static final Instant AGORA = Instant.parse("2026-09-25T12:00:00Z");
    private static final Duration LIMITE = Duration.ofSeconds(30);

    @Test
    void semLeituraEhSemDados() {
        assertThat(StatusSensor.de(null, AGORA, LIMITE)).isEqualTo(StatusSensor.SEM_DADOS);
    }

    @Test
    void leituraRecenteEhOnline() {
        assertThat(StatusSensor.de(AGORA.minusSeconds(5), AGORA, LIMITE)).isEqualTo(StatusSensor.ONLINE);
    }

    @Test
    void exatamenteNoLimiteAindaEhOnline() {
        assertThat(StatusSensor.de(AGORA.minusSeconds(30), AGORA, LIMITE)).isEqualTo(StatusSensor.ONLINE);
    }

    @Test
    void alemDoLimiteEhOffline() {
        assertThat(StatusSensor.de(AGORA.minusSeconds(31), AGORA, LIMITE)).isEqualTo(StatusSensor.OFFLINE);
    }

    @Test
    void relogioDoBancoAFrenteDaJvmContaComoOnline() {
        assertThat(StatusSensor.de(AGORA.plusSeconds(2), AGORA, LIMITE)).isEqualTo(StatusSensor.ONLINE);
    }

    @Test
    void agregadoUmOnlineBasta() {
        assertThat(StatusSensor.agregar(List.of(StatusSensor.OFFLINE, StatusSensor.ONLINE, StatusSensor.SEM_DADOS)))
                .isEqualTo(StatusSensor.ONLINE);
    }

    @Test
    void agregadoOfflineTemPrioridadeSobreSemDados() {
        assertThat(StatusSensor.agregar(List.of(StatusSensor.SEM_DADOS, StatusSensor.OFFLINE)))
                .isEqualTo(StatusSensor.OFFLINE);
    }

    @Test
    void agregadoSemSensoresEhSemDados() {
        assertThat(StatusSensor.agregar(List.of())).isEqualTo(StatusSensor.SEM_DADOS);
    }

}
