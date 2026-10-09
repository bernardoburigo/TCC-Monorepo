package br.unesc.tcc.backend.config;

import java.time.Clock;
import java.util.List;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableConfigurationProperties(AppProperties.class)
public class AppConfig {

    // Relógio injetável: os serviços não chamam Instant.now() direto.
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    // O app Expo Web roda em outra origem (localhost:8081) e o navegador exige CORS.
    // Não usa cookies (JWT no header Authorization), então allowCredentials fica desligado.
    // O app mobile (React Native) não é afetado: CORS é uma restrição só de navegador.
    @Bean
    public CorsConfigurationSource corsConfigurationSource(AppProperties props) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(props.cors().allowedOrigins());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

}
