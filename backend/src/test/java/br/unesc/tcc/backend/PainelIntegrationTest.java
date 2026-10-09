package br.unesc.tcc.backend;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import br.unesc.tcc.backend.consumo.dto.ConsumoApartamentoResponse;
import br.unesc.tcc.backend.leitura.dto.LeituraResponse;
import br.unesc.tcc.backend.painel.dto.ApartamentoPainelResponse;
import br.unesc.tcc.backend.sensor.StatusSensor;
import br.unesc.tcc.backend.sensor.dto.SensorCriadoResponse;
import br.unesc.tcc.backend.sensor.dto.SensorResponse;
import br.unesc.tcc.backend.sensor.dto.SensorStatusResponse;
import br.unesc.tcc.backend.usuario.UsuarioRole;
import br.unesc.tcc.backend.usuario.dto.UsuarioResponse;

// Endpoints do app (Sprint 4): visão por papel, status de sensor, leituras recentes,
// agrupamento de consumo no fuso de America/Sao_Paulo, CORS e 401 x 403.
class PainelIntegrationTest extends IntegrationTestBase {

    // ---------- autenticação: 401 (refazer login) x 403 (sem permissão) ----------

    @Test
    void semTokenOuComTokenInvalidoRetorna401() {
        assertThat(restTemplate.exchange("/api/me/apartamentos", HttpMethod.GET, HttpEntity.EMPTY, String.class)
                .getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        assertThat(restTemplate.exchange("/api/me/apartamentos", HttpMethod.GET, autenticado("lixo.que.nao.eh.jwt"), String.class)
                .getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void autenticadoSemPermissaoDeCrudRetorna403NaoOs401() {
        String jwtSindico = novoSindico("Condomínio 403");
        UUID apto = novoApartamento(jwtSindico, condominioDoSindico(jwtSindico), "101");
        String jwtProprietario = novoProprietario(List.of(apto));
        // CRUD de condomínios é só do SINDICO: proprietário autenticado leva 403, não 401
        assertThat(restTemplate.exchange("/api/condominios", HttpMethod.GET, autenticado(jwtProprietario), String.class)
                .getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void meRetornaOUsuarioAutenticado() {
        String jwt = novoSindico("Condomínio Me");
        ResponseEntity<UsuarioResponse> resposta = restTemplate.exchange(
                "/api/me", HttpMethod.GET, autenticado(jwt), UsuarioResponse.class);

        assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resposta.getBody().role()).isEqualTo(UsuarioRole.SINDICO);
        assertThat(resposta.getBody().email()).startsWith("sindico-");
    }

    // ---------- lista de apartamentos por papel ----------

    @Test
    void sindicoVeTodosOsApartamentosComConsumoDeHojeEStatus() {
        String jwt = novoSindico("Condomínio Lista");
        UUID condominioId = condominioDoSindico(jwt);
        UUID apto101 = novoApartamento(jwt, condominioId, "101");
        UUID apto102 = novoApartamento(jwt, condominioId, "102");
        UUID apto103 = novoApartamento(jwt, condominioId, "103");

        SensorCriadoResponse sensorSimulado = novoSensor(jwt, apto101, "Sensor 101", true);
        novoSensor(jwt, apto102, "Sensor 102", false);   // sem nenhuma leitura
        // apto 103: sem sensor

        Instant agora = Instant.now();
        postarLeitura(sensorSimulado.token(), sensorSimulado.id(), agora.minus(2, ChronoUnit.DAYS), 100, 300.0, 0);  // não é "hoje"
        postarLeitura(sensorSimulado.token(), sensorSimulado.id(), agora, 225, 500.0, 1);                            // hoje

        // outro síndico/condomínio: não pode aparecer na lista
        String jwtOutro = novoSindico("Condomínio Outro");
        novoApartamento(jwtOutro, condominioDoSindico(jwtOutro), "201");

        List<ApartamentoPainelResponse> lista = listarMeusApartamentos(jwt);

        assertThat(lista).extracting(ApartamentoPainelResponse::numero).containsExactly("101", "102", "103");
        assertThat(lista).allSatisfy(a -> {
            assertThat(a.condominioId()).isEqualTo(condominioId);
            assertThat(a.condominioNome()).isEqualTo("Condomínio Lista");
        });

        ApartamentoPainelResponse a101 = lista.get(0);
        assertThat(a101.id()).isEqualTo(apto101);
        assertThat(a101.consumoHojeMl()).isEqualTo(500.0);          // só a leitura de hoje
        assertThat(a101.qtdSensores()).isEqualTo(1);
        assertThat(a101.status()).isEqualTo(StatusSensor.ONLINE);
        assertThat(a101.simulado()).isTrue();
        assertThat(a101.ultimaLeituraEm()).isNotNull();

        ApartamentoPainelResponse a102 = lista.get(1);
        assertThat(a102.id()).isEqualTo(apto102);
        assertThat(a102.consumoHojeMl()).isZero();
        assertThat(a102.qtdSensores()).isEqualTo(1);
        assertThat(a102.status()).isEqualTo(StatusSensor.SEM_DADOS);
        assertThat(a102.simulado()).isFalse();
        assertThat(a102.ultimaLeituraEm()).isNull();

        ApartamentoPainelResponse a103 = lista.get(2);
        assertThat(a103.id()).isEqualTo(apto103);
        assertThat(a103.qtdSensores()).isZero();
        assertThat(a103.status()).isEqualTo(StatusSensor.SEM_DADOS);
    }

    @Test
    void proprietarioVeApenasOsSeusApartamentosEConsultaSeusSensores() {
        String jwtSindico = novoSindico("Condomínio Dono");
        UUID condominioId = condominioDoSindico(jwtSindico);
        UUID apto101 = novoApartamento(jwtSindico, condominioId, "101");
        UUID apto102 = novoApartamento(jwtSindico, condominioId, "102");
        SensorCriadoResponse sensor101 = novoSensor(jwtSindico, apto101, "Sensor 101", null);
        SensorCriadoResponse sensor102 = novoSensor(jwtSindico, apto102, "Sensor 102", null);

        String jwtDono = novoProprietario(List.of(apto101));

        List<ApartamentoPainelResponse> lista = listarMeusApartamentos(jwtDono);
        assertThat(lista).extracting(ApartamentoPainelResponse::numero).containsExactly("101");

        assertThat(sensoresDoApartamento(jwtDono, apto101).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(sensoresDoApartamento(jwtDono, apto102).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(status(jwtDono, sensor101.id()).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(status(jwtDono, sensor102.id()).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void sindicoDeOutroCondominioNaoAcessaSensoresNemLeituras() {
        String jwtSindico = novoSindico("Condomínio Dono");
        UUID apto = novoApartamento(jwtSindico, condominioDoSindico(jwtSindico), "101");
        SensorCriadoResponse sensor = novoSensor(jwtSindico, apto, "Sensor 101", null);

        String jwtOutro = novoSindico("Condomínio Intruso");

        assertThat(sensoresDoApartamento(jwtOutro, apto).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(status(jwtOutro, sensor.id()).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(restTemplate.exchange("/api/sensores/" + sensor.id() + "/leituras", HttpMethod.GET,
                autenticado(jwtOutro), String.class).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        assertThat(status(jwtSindico, UUID.randomUUID()).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ---------- status e leituras recentes ----------

    @Test
    void statusDoSensorReflitaAUltimaLeituraRecebida() {
        String jwt = novoSindico("Condomínio Status");
        UUID apto = novoApartamento(jwt, condominioDoSindico(jwt), "101");
        SensorCriadoResponse sensor = novoSensor(jwt, apto, "Sensor 101", true);

        SensorStatusResponse semLeitura = status(jwt, sensor.id(), SensorStatusResponse.class).getBody();
        assertThat(semLeitura.status()).isEqualTo(StatusSensor.SEM_DADOS);
        assertThat(semLeitura.ultimaLeituraEm()).isNull();
        assertThat(semLeitura.simulado()).isTrue();
        assertThat(semLeitura.apartamentoNumero()).isEqualTo("101");

        Instant medidaEm = Instant.now().minusSeconds(3);
        postarLeitura(sensor.token(), sensor.id(), medidaEm, 10, 22.2, 0);

        SensorStatusResponse comLeitura = status(jwt, sensor.id(), SensorStatusResponse.class).getBody();
        assertThat(comLeitura.status()).isEqualTo(StatusSensor.ONLINE);
        assertThat(comLeitura.ultimoTimestampLeitura()).isEqualTo(medidaEm.truncatedTo(ChronoUnit.MILLIS));
        assertThat(comLeitura.ultimaLeituraEm()).isAfterOrEqualTo(medidaEm);

        List<SensorStatusResponse> doApartamento = restTemplate.exchange(
                "/api/apartamentos/" + apto + "/sensores", HttpMethod.GET, autenticado(jwt),
                new ParameterizedTypeReference<List<SensorStatusResponse>>() {
                }).getBody();
        assertThat(doApartamento).hasSize(1);
        assertThat(doApartamento.get(0).status()).isEqualTo(StatusSensor.ONLINE);
    }

    @Test
    void leiturasRecentesFiltramPeloPeriodoEmOrdemCronologica() {
        String jwt = novoSindico("Condomínio Leituras");
        UUID apto = novoApartamento(jwt, condominioDoSindico(jwt), "101");
        SensorCriadoResponse sensor = novoSensor(jwt, apto, "Sensor 101", null);

        Instant agora = Instant.now();
        postarLeitura(sensor.token(), sensor.id(), agora.minus(10, ChronoUnit.MINUTES), 10, 22.0, 0);
        postarLeitura(sensor.token(), sensor.id(), agora.minusSeconds(30), 20, 44.0, 1);
        postarLeitura(sensor.token(), sensor.id(), agora.minus(2, ChronoUnit.HOURS), 5, 11.0, 2);

        // padrão = 30 min: a de 10 min e a de 30 s, da mais antiga para a mais nova
        assertThat(leituras(jwt, sensor.id(), null)).extracting(LeituraResponse::sequencia).containsExactly(0L, 1L);

        // 240 min: inclui a de 2 h, em ordem cronológica (2 h atrás, 10 min atrás, 30 s atrás)
        assertThat(leituras(jwt, sensor.id(), 240)).extracting(LeituraResponse::sequencia).containsExactly(2L, 0L, 1L);

        // acima do máximo é limitado a 240 (não é erro); abaixo do mínimo, a 1 minuto
        assertThat(leituras(jwt, sensor.id(), 100000)).hasSize(3);
        assertThat(leituras(jwt, sensor.id(), 0)).extracting(LeituraResponse::sequencia).containsExactly(1L);
    }

    // ---------- consumo agregado no fuso de America/Sao_Paulo ----------

    @Test
    void consumoPorDiaUsaODiaCivilDeSaoPauloEmVezDeUtc() {
        String jwt = novoSindico("Condomínio Fuso");
        UUID apto = novoApartamento(jwt, condominioDoSindico(jwt), "101");
        SensorCriadoResponse sensor = novoSensor(jwt, apto, "Sensor 101", null);

        // 2026-03-10T01:00Z = 22:00 do dia 09 em São Paulo (UTC-3); 04:00Z = 01:00 do dia 10.
        // Em UTC as duas cairiam no mesmo dia (10); no fuso local são dias diferentes.
        postarLeitura(sensor.token(), sensor.id(), Instant.parse("2026-03-10T01:00:00Z"), 100, 100.0, 0);
        postarLeitura(sensor.token(), sensor.id(), Instant.parse("2026-03-10T04:00:00Z"), 200, 200.0, 1);

        ConsumoApartamentoResponse consumo = consumo(jwt, apto, "2026-03-09T00:00:00Z", "2026-03-11T00:00:00Z", "DIA");

        assertThat(consumo.pontos()).hasSize(2);
        assertThat(consumo.pontos().get(0).periodo()).isEqualTo(Instant.parse("2026-03-09T03:00:00Z"));  // 00:00 de 09/03 em SP
        assertThat(consumo.pontos().get(0).volumeTotalMl()).isEqualTo(100.0);
        assertThat(consumo.pontos().get(1).periodo()).isEqualTo(Instant.parse("2026-03-10T03:00:00Z"));  // 00:00 de 10/03 em SP
        assertThat(consumo.pontos().get(1).volumeTotalMl()).isEqualTo(200.0);
    }

    @Test
    void inicioEhAlinhadoAoComecoDoIntervaloParaOPrimeiroPontoNaoVirParcial() {
        String jwt = novoSindico("Condomínio Alinhamento");
        UUID apto = novoApartamento(jwt, condominioDoSindico(jwt), "101");
        SensorCriadoResponse sensor = novoSensor(jwt, apto, "Sensor 101", null);

        // 09:00 locais do dia 08/03 (12:00Z). O período pedido começa às 15:00 locais (18:00Z):
        // sem alinhamento essa leitura ficaria de fora e o dia 08 sairia sem consumo.
        postarLeitura(sensor.token(), sensor.id(), Instant.parse("2026-03-08T12:00:00Z"), 100, 100.0, 0);

        ConsumoApartamentoResponse consumo = consumo(jwt, apto, "2026-03-08T18:00:00Z", "2026-03-09T12:00:00Z", "DIA");

        assertThat(consumo.inicio()).isEqualTo(Instant.parse("2026-03-08T03:00:00Z"));   // 00:00 de 08/03 em SP
        assertThat(consumo.pontos()).hasSize(1);
        assertThat(consumo.pontos().get(0).periodo()).isEqualTo(Instant.parse("2026-03-08T03:00:00Z"));
        assertThat(consumo.pontos().get(0).volumeTotalMl()).isEqualTo(100.0);
    }

    @Test
    void granularidadeMinutoAgrupaPorMinuto() {
        String jwt = novoSindico("Condomínio Minuto");
        UUID apto = novoApartamento(jwt, condominioDoSindico(jwt), "101");
        SensorCriadoResponse sensor = novoSensor(jwt, apto, "Sensor 101", null);

        postarLeitura(sensor.token(), sensor.id(), Instant.parse("2026-03-10T01:00:10Z"), 10, 10.0, 0);
        postarLeitura(sensor.token(), sensor.id(), Instant.parse("2026-03-10T01:00:50Z"), 10, 20.0, 1);
        postarLeitura(sensor.token(), sensor.id(), Instant.parse("2026-03-10T01:01:05Z"), 10, 40.0, 2);

        ConsumoApartamentoResponse consumo = consumo(jwt, apto, "2026-03-10T01:00:00Z", "2026-03-10T01:05:00Z", "MINUTO");

        assertThat(consumo.pontos()).hasSize(2);
        assertThat(consumo.pontos().get(0).periodo()).isEqualTo(Instant.parse("2026-03-10T01:00:00Z"));
        assertThat(consumo.pontos().get(0).volumeTotalMl()).isEqualTo(30.0);
        assertThat(consumo.pontos().get(1).periodo()).isEqualTo(Instant.parse("2026-03-10T01:01:00Z"));
        assertThat(consumo.pontos().get(1).volumeTotalMl()).isEqualTo(40.0);
    }

    // ---------- CORS ----------

    @Test
    void preflightCorsLiberaApenasAsOrigensConfiguradas() {
        ResponseEntity<String> permitida = preflight("http://localhost:8081");
        assertThat(permitida.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(permitida.getHeaders().getFirst("Access-Control-Allow-Origin")).isEqualTo("http://localhost:8081");
        assertThat(permitida.getHeaders().getFirst("Access-Control-Allow-Headers")).containsIgnoringCase("authorization");

        assertThat(preflight("http://site-desconhecido.example").getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    // ---------- flag simulado ----------

    @Test
    void sensorSimuladoEhGravadoEExpostoNaApi() {
        String jwt = novoSindico("Condomínio Simulado");
        UUID apto = novoApartamento(jwt, condominioDoSindico(jwt), "101");

        SensorCriadoResponse simulado = novoSensor(jwt, apto, "Sensor simulado", true);
        SensorCriadoResponse real = novoSensor(jwt, apto, "Sensor real", null);   // omitido = false

        assertThat(simulado.simulado()).isTrue();
        assertThat(real.simulado()).isFalse();

        SensorResponse lido = restTemplate.exchange(
                "/api/sensores/" + simulado.id(), HttpMethod.GET, autenticado(jwt), SensorResponse.class).getBody();
        assertThat(lido.simulado()).isTrue();
    }

    // ---------- helpers ----------

    private List<ApartamentoPainelResponse> listarMeusApartamentos(String jwt) {
        ResponseEntity<List<ApartamentoPainelResponse>> resposta = restTemplate.exchange(
                "/api/me/apartamentos", HttpMethod.GET, autenticado(jwt),
                new ParameterizedTypeReference<List<ApartamentoPainelResponse>>() {
                });
        assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.OK);
        return resposta.getBody();
    }

    private ResponseEntity<String> sensoresDoApartamento(String jwt, UUID apartamentoId) {
        return restTemplate.exchange("/api/apartamentos/" + apartamentoId + "/sensores", HttpMethod.GET, autenticado(jwt), String.class);
    }

    private ResponseEntity<String> status(String jwt, UUID sensorId) {
        return status(jwt, sensorId, String.class);
    }

    private <T> ResponseEntity<T> status(String jwt, UUID sensorId, Class<T> tipo) {
        return restTemplate.exchange("/api/sensores/" + sensorId + "/status", HttpMethod.GET, autenticado(jwt), tipo);
    }

    private List<LeituraResponse> leituras(String jwt, UUID sensorId, Integer minutos) {
        String path = "/api/sensores/" + sensorId + "/leituras" + (minutos != null ? "?minutos=" + minutos : "");
        ResponseEntity<List<LeituraResponse>> resposta = restTemplate.exchange(
                path, HttpMethod.GET, autenticado(jwt), new ParameterizedTypeReference<List<LeituraResponse>>() {
                });
        assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.OK);
        return resposta.getBody();
    }

    private ConsumoApartamentoResponse consumo(String jwt, UUID apartamentoId, String inicio, String fim, String granularidade) {
        String path = "/api/apartamentos/%s/consumo?inicio=%s&fim=%s&granularidade=%s".formatted(apartamentoId, inicio, fim, granularidade);
        ResponseEntity<ConsumoApartamentoResponse> resposta = restTemplate.exchange(
                path, HttpMethod.GET, autenticado(jwt), ConsumoApartamentoResponse.class);
        assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.OK);
        return resposta.getBody();
    }

    private ResponseEntity<String> preflight(String origem) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Origin", origem);
        headers.set("Access-Control-Request-Method", "GET");
        headers.set("Access-Control-Request-Headers", "authorization");
        return restTemplate.exchange("/api/me/apartamentos", HttpMethod.OPTIONS, new HttpEntity<>(headers), String.class);
    }

}
