package br.unesc.tcc.backend.sensor;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.unesc.tcc.backend.leitura.dto.LeituraResponse;
import br.unesc.tcc.backend.sensor.dto.SensorStatusResponse;
import lombok.RequiredArgsConstructor;

// Leitura de sensores para o app (Sprint 4). Separado do SensorController de propósito:
// aquele é @PreAuthorize("hasRole('SINDICO')") (CRUD com token); estes endpoints servem
// também o PROPRIETARIO, com a regra "síndico do condomínio OU dono do apartamento"
// aplicada no serviço.
@RestController
@RequiredArgsConstructor
public class SensorStatusController {

    private final SensorStatusService sensorStatusService;

    @GetMapping("/api/apartamentos/{apartamentoId}/sensores")
    public List<SensorStatusResponse> listarPorApartamento(@PathVariable UUID apartamentoId) {
        return sensorStatusService.listarPorApartamento(apartamentoId);
    }

    @GetMapping("/api/sensores/{id}/status")
    public SensorStatusResponse status(@PathVariable UUID id) {
        return sensorStatusService.buscar(id);
    }

    @GetMapping("/api/sensores/{id}/leituras")
    public List<LeituraResponse> leiturasRecentes(
            @PathVariable UUID id,
            @RequestParam(required = false) Integer minutos) {
        return sensorStatusService.leiturasRecentes(id, minutos);
    }

}
