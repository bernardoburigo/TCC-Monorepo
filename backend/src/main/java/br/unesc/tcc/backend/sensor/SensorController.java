package br.unesc.tcc.backend.sensor;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.unesc.tcc.backend.sensor.dto.SensorCriadoResponse;
import br.unesc.tcc.backend.sensor.dto.SensorRequest;
import br.unesc.tcc.backend.sensor.dto.SensorResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/sensores")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SINDICO')")
public class SensorController {

    private final SensorService sensorService;

    @GetMapping
    public List<SensorResponse> listar(@RequestParam UUID apartamentoId) {
        return sensorService.listarPorApartamento(apartamentoId);
    }

    @GetMapping("/{id}")
    public SensorResponse buscar(@PathVariable UUID id) {
        return sensorService.buscar(id);
    }

    @PostMapping
    public ResponseEntity<SensorCriadoResponse> criar(@Valid @RequestBody SensorRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(sensorService.criar(request));
    }

    @PutMapping("/{id}")
    public SensorResponse atualizar(@PathVariable UUID id, @Valid @RequestBody SensorRequest request) {
        return sensorService.atualizar(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable UUID id) {
        sensorService.excluir(id);
        return ResponseEntity.noContent().build();
    }

}
