package br.unesc.tcc.backend;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import br.unesc.tcc.backend.sensor.dto.SensorCriadoResponse;

// Contrato de ingestão do ponto de vista do firmware (Sprint 3): o ESP32 envia o JSON
// como texto puro (não um record serializado pelo Jackson), com timestamp ISO-8601 em
// UTC com milissegundos e `Z`, e ramifica o comportamento pelo status HTTP:
//   201/409 -> sucesso, 400 -> descarta, 401 -> erro de configuração, resto -> retenta.
class IngestaoFirmwareIntegrationTest extends IntegrationTestBase {

    private UUID sensorId;
    private String tokenSensor;

    @BeforeEach
    void provisionarSensor() {
        String jwt = novoSindico("Condomínio FW");
        UUID apartamentoId = novoApartamento(jwt, condominioDoSindico(jwt), "201");
        SensorCriadoResponse sensor = novoSensor(jwt, apartamentoId, "Sensor FW", null);
        sensorId = sensor.id();
        tokenSensor = sensor.token();
    }

    @Test
    void aceitaPayloadNoFormatoExatoDoFirmware() {
        // janela com fluxo e janela sem fluxo (heartbeat: pulsos=0, volume=0.0)
        assertThat(enviar(tokenSensor, json(sensorId, "2026-09-25T12:00:05.123Z", 37, 82.2, 0)).getStatusCode())
                .isEqualTo(HttpStatus.CREATED);
        assertThat(enviar(tokenSensor, json(sensorId, "2026-09-25T12:00:10.124Z", 0, 0.0, 1)).getStatusCode())
                .isEqualTo(HttpStatus.CREATED);
    }

    @Test
    void reenvioDaMesmaLeituraRetorna409() {
        String corpo = json(sensorId, "2026-09-25T12:01:00.000Z", 10, 22.2, 5);
        assertThat(enviar(tokenSensor, corpo).getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(enviar(tokenSensor, corpo).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void tokenInvalidoRetorna401() {
        assertThat(enviar("token-invalido", json(sensorId, "2026-09-25T12:02:00.000Z", 1, 2.2, 0)).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void headerAusenteRetorna400() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<String> resposta = restTemplate.exchange(
                "/api/leituras", HttpMethod.POST,
                new HttpEntity<>(json(sensorId, "2026-09-25T12:03:00.000Z", 1, 2.2, 0), headers), String.class);
        assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void jsonMalformadoRetorna400() {
        assertThat(enviar(tokenSensor, "{quebrado").getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    private ResponseEntity<String> enviar(String token, String corpo) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Sensor-Token", token);
        return restTemplate.exchange("/api/leituras", HttpMethod.POST, new HttpEntity<>(corpo, headers), String.class);
    }

    private String json(UUID sensorId, String timestamp, long pulsos, double volumeMl, long sequencia) {
        return "{\"sensorId\":\"%s\",\"timestampLeitura\":\"%s\",\"pulsos\":%d,\"volumeMlEstimado\":%s,\"sequencia\":%d}"
                .formatted(sensorId, timestamp, pulsos, Double.toString(volumeMl), sequencia);
    }

}
