package br.unesc.tcc.backend;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import br.unesc.tcc.backend.apartamento.dto.ApartamentoRequest;
import br.unesc.tcc.backend.apartamento.dto.ApartamentoResponse;
import br.unesc.tcc.backend.condominio.dto.CondominioResponse;
import br.unesc.tcc.backend.consumo.dto.ConsumoApartamentoResponse;
import br.unesc.tcc.backend.leitura.dto.LeituraRequest;
import br.unesc.tcc.backend.leitura.dto.LeituraResponse;
import br.unesc.tcc.backend.sensor.dto.SensorCriadoResponse;
import br.unesc.tcc.backend.sensor.dto.SensorRequest;
import br.unesc.tcc.backend.usuario.UsuarioRole;
import br.unesc.tcc.backend.usuario.dto.RegistroRequest;

class FluxoCompletoIntegrationTest extends IntegrationTestBase {

    @Test
    void fluxoCompletoDeRegistroIngestaoEConsumo() {
        String emailSindico = "sindico-" + UUID.randomUUID() + "@teste.com";
        registrar(new RegistroRequest("Síndico Teste", emailSindico, "senha12345", UsuarioRole.SINDICO, "Condomínio Teste", null));
        String tokenSindico = logar(emailSindico, "senha12345");

        List<CondominioResponse> condominios = restTemplate.exchange(
                "/api/condominios", HttpMethod.GET, autenticado(tokenSindico),
                new org.springframework.core.ParameterizedTypeReference<List<CondominioResponse>>() {
                }).getBody();
        assertThat(condominios).hasSize(1);
        UUID condominioId = condominios.get(0).id();

        ResponseEntity<ApartamentoResponse> apartamentoResp = restTemplate.exchange(
                "/api/apartamentos", HttpMethod.POST,
                autenticado(tokenSindico, new ApartamentoRequest(condominioId, "101")),
                ApartamentoResponse.class);
        assertThat(apartamentoResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        UUID apartamentoId = apartamentoResp.getBody().id();

        ResponseEntity<SensorCriadoResponse> sensorResp = restTemplate.exchange(
                "/api/sensores", HttpMethod.POST,
                autenticado(tokenSindico, new SensorRequest(apartamentoId, "Sensor 101")),
                SensorCriadoResponse.class);
        assertThat(sensorResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        UUID sensorId = sensorResp.getBody().id();
        String tokenSensor = sensorResp.getBody().token();

        Instant agora = Instant.now();
        LeituraRequest leituraRequest = new LeituraRequest(sensorId, agora, 450L, 1000.0, 1L);

        HttpHeaders headersSensor = new HttpHeaders();
        headersSensor.set("X-Sensor-Token", tokenSensor);
        ResponseEntity<LeituraResponse> leituraResp = restTemplate.exchange(
                "/api/leituras", HttpMethod.POST, new HttpEntity<>(leituraRequest, headersSensor), LeituraResponse.class);
        assertThat(leituraResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        // mesma sensorId + sequencia + timestamp -> 409 (deduplicação)
        ResponseEntity<String> duplicadaResp = restTemplate.exchange(
                "/api/leituras", HttpMethod.POST, new HttpEntity<>(leituraRequest, headersSensor), String.class);
        assertThat(duplicadaResp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);

        // token errado -> 401
        HttpHeaders headersTokenErrado = new HttpHeaders();
        headersTokenErrado.set("X-Sensor-Token", "token-invalido");
        ResponseEntity<String> tokenErradoResp = restTemplate.exchange(
                "/api/leituras", HttpMethod.POST,
                new HttpEntity<>(new LeituraRequest(sensorId, agora.plusSeconds(1), 10L, 20.0, 2L), headersTokenErrado),
                String.class);
        assertThat(tokenErradoResp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        String emailProprietario = "proprietario-" + UUID.randomUUID() + "@teste.com";
        registrar(new RegistroRequest("Proprietário Teste", emailProprietario, "senha12345", UsuarioRole.PROPRIETARIO, null, List.of(apartamentoId)));
        String tokenProprietario = logar(emailProprietario, "senha12345");

        String path = "/api/apartamentos/%s/consumo?inicio=%s&fim=%s&granularidade=DIA"
                .formatted(apartamentoId, agora.minusSeconds(3600), agora.plusSeconds(3600));

        ResponseEntity<ConsumoApartamentoResponse> consumoComoSindico = restTemplate.exchange(
                path, HttpMethod.GET, autenticado(tokenSindico), ConsumoApartamentoResponse.class);
        assertThat(consumoComoSindico.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(consumoComoSindico.getBody().pontos()).hasSize(1);
        assertThat(consumoComoSindico.getBody().pontos().get(0).volumeTotalMl()).isEqualTo(1000.0);

        ResponseEntity<ConsumoApartamentoResponse> consumoComoDono = restTemplate.exchange(
                path, HttpMethod.GET, autenticado(tokenProprietario), ConsumoApartamentoResponse.class);
        assertThat(consumoComoDono.getStatusCode()).isEqualTo(HttpStatus.OK);

        // outro síndico (outro condomínio) não pode ver o consumo deste apartamento
        String emailOutroSindico = "outro-sindico-" + UUID.randomUUID() + "@teste.com";
        registrar(new RegistroRequest("Outro Síndico", emailOutroSindico, "senha12345", UsuarioRole.SINDICO, "Outro Condomínio", null));
        String tokenOutroSindico = logar(emailOutroSindico, "senha12345");

        ResponseEntity<String> consumoNegado = restTemplate.exchange(
                path, HttpMethod.GET, autenticado(tokenOutroSindico), String.class);
        assertThat(consumoNegado.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

}
