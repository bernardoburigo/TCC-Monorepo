package br.unesc.tcc.backend.leitura;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import br.unesc.tcc.backend.leitura.dto.LeituraRequest;
import br.unesc.tcc.backend.leitura.dto.LeituraResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

// Endpoint público na configuração de segurança (SecurityConfig): não usa JWT,
// pois o ESP32 não faz login -- autentica via header X-Sensor-Token (API key por sensor).
@RestController
@RequestMapping("/api/leituras")
@RequiredArgsConstructor
public class LeituraController {

    private final LeituraService leituraService;

    @PostMapping
    public ResponseEntity<LeituraResponse> registrar(
            @RequestHeader("X-Sensor-Token") String tokenSensor,
            @Valid @RequestBody LeituraRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(leituraService.registrar(tokenSensor, request));
    }

}
