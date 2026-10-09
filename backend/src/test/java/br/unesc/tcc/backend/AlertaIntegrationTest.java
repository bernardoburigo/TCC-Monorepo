package br.unesc.tcc.backend;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;

import br.unesc.tcc.backend.alerta.TipoAlerta;
import br.unesc.tcc.backend.alerta.dto.AlertaResponse;
import br.unesc.tcc.backend.painel.dto.ApartamentoPainelResponse;
import br.unesc.tcc.backend.sensor.dto.SensorCriadoResponse;

// Limite reduzido de 30 para 2 minutos só neste teste, para não precisar de 360 POSTs por caso.
// A lógica em si (limite, lacunas, pausas) é coberta por DetectorFluxoContinuoTest.
@TestPropertySource(properties = "app.alerta.fluxo-continuo-minutos=2")
class AlertaIntegrationTest extends IntegrationTestBase {

    // Envia janelas de 5 s de `minutos` minutos, terminando 1 s atrás, todas com fluxo.
    private void enviarFluxoContinuo(SensorCriadoResponse sensor, int minutos, Integer indiceDaJanelaSemFluxo) {
        Instant fim = Instant.now().minusSeconds(1);
        int quantidade = minutos * 12;
        for (int i = 0; i < quantidade; i++) {
            Instant fimDaJanela = fim.minusSeconds(5L * (quantidade - 1 - i));
            boolean semFluxo = indiceDaJanelaSemFluxo != null && i == indiceDaJanelaSemFluxo;
            postarLeitura(sensor.token(), sensor.id(), fimDaJanela, semFluxo ? 0 : 10, semFluxo ? 0.0 : 22.2, i);
        }
    }

    private List<AlertaResponse> alertas(String jwt, UUID apartamentoId) {
        ResponseEntity<List<AlertaResponse>> resposta = restTemplate.exchange(
                "/api/apartamentos/" + apartamentoId + "/alertas", HttpMethod.GET, autenticado(jwt),
                new ParameterizedTypeReference<List<AlertaResponse>>() {
                });
        assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.OK);
        return resposta.getBody();
    }

    private boolean painelIndicaAlerta(String jwt, UUID apartamentoId) {
        return restTemplate.exchange("/api/me/apartamentos", HttpMethod.GET, autenticado(jwt),
                new ParameterizedTypeReference<List<ApartamentoPainelResponse>>() {
                }).getBody().stream().filter(a -> a.id().equals(apartamentoId)).findFirst().orElseThrow().alertaVazamento();
    }

    @Test
    void fluxoContinuoAlemDoLimiteGeraAlertaNaApiENoPainel() {
        String jwt = novoSindico("Condomínio Alerta");
        UUID apto = novoApartamento(jwt, condominioDoSindico(jwt), "101");
        SensorCriadoResponse sensor = novoSensor(jwt, apto, "Sensor com vazamento", true);

        enviarFluxoContinuo(sensor, 3, null);   // 3 min contínuos > limite de 2 min

        List<AlertaResponse> lista = alertas(jwt, apto);
        assertThat(lista).hasSize(1);
        AlertaResponse alerta = lista.get(0);
        assertThat(alerta.tipo()).isEqualTo(TipoAlerta.VAZAMENTO_PROVAVEL);
        assertThat(alerta.sensorId()).isEqualTo(sensor.id());
        assertThat(alerta.apartamentoId()).isEqualTo(apto);
        assertThat(alerta.duracaoSegundos()).isGreaterThanOrEqualTo(170);
        assertThat(alerta.volumeMl()).isGreaterThan(36 * 22.0 - 1);
        assertThat(alerta.simulado()).isTrue();

        assertThat(painelIndicaAlerta(jwt, apto)).isTrue();
    }

    @Test
    void umaJanelaSemFluxoRecenteDesfazOAlerta() {
        String jwt = novoSindico("Condomínio Pausa");
        UUID apto = novoApartamento(jwt, condominioDoSindico(jwt), "101");
        SensorCriadoResponse sensor = novoSensor(jwt, apto, "Sensor", null);

        enviarFluxoContinuo(sensor, 3, 30);   // pausa na janela 30 (~1,5 min atrás): restam < 2 min contínuos

        assertThat(alertas(jwt, apto)).isEmpty();
        assertThat(painelIndicaAlerta(jwt, apto)).isFalse();
    }

    @Test
    void fluxoAbaixoDoLimiteNaoAlerta() {
        String jwt = novoSindico("Condomínio Curto");
        UUID apto = novoApartamento(jwt, condominioDoSindico(jwt), "101");
        SensorCriadoResponse sensor = novoSensor(jwt, apto, "Sensor", null);

        enviarFluxoContinuo(sensor, 1, null);   // 1 min < 2 min

        assertThat(alertas(jwt, apto)).isEmpty();
    }

    @Test
    void sensorSemLeituraNaoAlerta() {
        String jwt = novoSindico("Condomínio Vazio");
        UUID apto = novoApartamento(jwt, condominioDoSindico(jwt), "101");
        novoSensor(jwt, apto, "Sensor sem leituras", null);

        assertThat(alertas(jwt, apto)).isEmpty();
    }

    @Test
    void alertasSeguemARegraDeAcessoDoApartamento() {
        String jwtSindico = novoSindico("Condomínio Acesso");
        UUID apto = novoApartamento(jwtSindico, condominioDoSindico(jwtSindico), "101");
        UUID outroApto = novoApartamento(jwtSindico, condominioDoSindico(jwtSindico), "102");
        String jwtDono = novoProprietario(List.of(apto));
        String jwtOutroSindico = novoSindico("Condomínio Intruso");

        assertThat(alertas(jwtDono, apto)).isEmpty();   // dono do apartamento: 200
        assertThat(restTemplate.exchange("/api/apartamentos/" + outroApto + "/alertas", HttpMethod.GET,
                autenticado(jwtDono), String.class).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(restTemplate.exchange("/api/apartamentos/" + apto + "/alertas", HttpMethod.GET,
                autenticado(jwtOutroSindico), String.class).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

}
