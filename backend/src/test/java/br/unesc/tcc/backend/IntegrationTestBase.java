package br.unesc.tcc.backend;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.http.HttpClient;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.client.ResponseErrorHandler;
import org.springframework.web.client.RestTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import br.unesc.tcc.backend.apartamento.dto.ApartamentoRequest;
import br.unesc.tcc.backend.apartamento.dto.ApartamentoResponse;
import br.unesc.tcc.backend.condominio.dto.CondominioResponse;
import br.unesc.tcc.backend.sensor.dto.SensorCriadoResponse;
import br.unesc.tcc.backend.sensor.dto.SensorRequest;
import br.unesc.tcc.backend.usuario.UsuarioRole;
import br.unesc.tcc.backend.usuario.dto.LoginRequest;
import br.unesc.tcc.backend.usuario.dto.LoginResponse;
import br.unesc.tcc.backend.usuario.dto.RegistroRequest;

// Mesma imagem já validada no docker-compose.yml (Sprint 0): Postgres 16 + TimescaleDB.
//
// Padrão "singleton container" do Testcontainers: o campo `postgres` é `static` e
// iniciado manualmente uma única vez (bloco static), NÃO via @Testcontainers/@Container.
// Como o campo é herdado por várias classes de teste (BackendApplicationTests,
// FluxoCompletoIntegrationTest), usar a extensão JUnit5 (@Container) faria cada classe
// parar o container no seu próprio afterAll, quebrando a classe de teste seguinte que
// reutiliza a mesma instância. O Ryuk do Testcontainers derruba o container ao final da JVM.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public abstract class IntegrationTestBase {

    protected static final String ADMIN_TOKEN = "admin-token-de-teste";

    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
            DockerImageName.parse("timescale/timescaledb:latest-pg16").asCompatibleSubstituteFor("postgres"))
            .withDatabaseName("tcc_telemetria_test")
            .withUsername("tcc")
            .withPassword("tcc");

    static {
        postgres.start();
    }

    @DynamicPropertySource
    static void configurarDatasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("app.registro.admin-token", () -> ADMIN_TOKEN);
    }

    @LocalServerPort
    private int porta;

    // RestTemplate manual (não o TestRestTemplate autoconfigurado) usando
    // JdkClientHttpRequestFactory (java.net.http.HttpClient) em vez do
    // SimpleClientHttpRequestFactory padrão (JDK HttpURLConnection): este último tem um bug
    // conhecido -- "cannot retry due to server authentication, in streaming mode" -- ao ler
    // uma resposta de erro (409, 401, etc.) de um POST com corpo.
    protected RestTemplate restTemplate;

    @BeforeEach
    void configurarRestTemplate() {
        restTemplate = new RestTemplateBuilder()
                .rootUri("http://localhost:" + porta)
                .requestFactory(() -> new JdkClientHttpRequestFactory(HttpClient.newHttpClient()))
                // RestTemplate padrão lança exceção em 4xx/5xx; os testes verificam o
                // status via ResponseEntity.getStatusCode(), como o TestRestTemplate faria.
                .errorHandler(new ResponseErrorHandler() {
                    @Override
                    public boolean hasError(ClientHttpResponse response) {
                        return false;
                    }

                    @Override
                    public void handleError(ClientHttpResponse response) {
                    }
                })
                .build();
    }

    protected void registrar(RegistroRequest request) {
        assertThat(registrarComToken(ADMIN_TOKEN, request).getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    protected ResponseEntity<String> registrarComToken(String adminToken, RegistroRequest request) {
        HttpHeaders headers = new HttpHeaders();
        if (adminToken != null) {
            headers.set("X-Admin-Token", adminToken);
        }
        return restTemplate.postForEntity("/api/auth/registrar", new HttpEntity<>(request, headers), String.class);
    }

    protected String logar(String email, String senha) {
        ResponseEntity<LoginResponse> resposta = restTemplate.postForEntity("/api/auth/login", new LoginRequest(email, senha), LoginResponse.class);
        assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.OK);
        return resposta.getBody().token();
    }

    protected HttpEntity<Void> autenticado(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return new HttpEntity<>(headers);
    }

    protected <T> HttpEntity<T> autenticado(String token, T corpo) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return new HttpEntity<>(corpo, headers);
    }

    // ---- provisionamento reutilizável (síndico -> condomínio -> apartamento -> sensor) ----

    // Registra um síndico (o registro cria o condomínio) e devolve o JWT dele.
    protected String novoSindico(String nomeCondominio) {
        String email = "sindico-" + UUID.randomUUID() + "@teste.com";
        registrar(new RegistroRequest("Síndico Teste", email, "senha12345", UsuarioRole.SINDICO, nomeCondominio, null));
        return logar(email, "senha12345");
    }

    protected UUID condominioDoSindico(String jwtSindico) {
        return restTemplate.exchange(
                "/api/condominios", HttpMethod.GET, autenticado(jwtSindico),
                new ParameterizedTypeReference<List<CondominioResponse>>() {
                }).getBody().get(0).id();
    }

    protected UUID novoApartamento(String jwtSindico, UUID condominioId, String numero) {
        ResponseEntity<ApartamentoResponse> resposta = restTemplate.exchange(
                "/api/apartamentos", HttpMethod.POST,
                autenticado(jwtSindico, new ApartamentoRequest(condominioId, numero)),
                ApartamentoResponse.class);
        assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return resposta.getBody().id();
    }

    protected SensorCriadoResponse novoSensor(String jwtSindico, UUID apartamentoId, String identificador, Boolean simulado) {
        ResponseEntity<SensorCriadoResponse> resposta = restTemplate.exchange(
                "/api/sensores", HttpMethod.POST,
                autenticado(jwtSindico, new SensorRequest(apartamentoId, identificador, simulado)),
                SensorCriadoResponse.class);
        assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return resposta.getBody();
    }

    // Registra um proprietário vinculado aos apartamentos e devolve o JWT dele.
    protected String novoProprietario(List<UUID> apartamentoIds) {
        String email = "proprietario-" + UUID.randomUUID() + "@teste.com";
        registrar(new RegistroRequest("Proprietário Teste", email, "senha12345", UsuarioRole.PROPRIETARIO, null, apartamentoIds));
        return logar(email, "senha12345");
    }

    // POST /api/leituras como o firmware faz: JSON em texto puro, timestamp ISO-8601 com ms e `Z`.
    protected ResponseEntity<String> postarLeitura(
            String tokenSensor, UUID sensorId, Instant timestamp, long pulsos, double volumeMl, long sequencia) {
        String json = "{\"sensorId\":\"%s\",\"timestampLeitura\":\"%s\",\"pulsos\":%d,\"volumeMlEstimado\":%s,\"sequencia\":%d}"
                .formatted(sensorId, timestamp.truncatedTo(ChronoUnit.MILLIS), pulsos, Double.toString(volumeMl), sequencia);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Sensor-Token", tokenSensor);
        return restTemplate.exchange("/api/leituras", HttpMethod.POST, new HttpEntity<>(json, headers), String.class);
    }

}
