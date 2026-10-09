package br.unesc.tcc.backend.alerta;

import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import br.unesc.tcc.backend.alerta.dto.AlertaResponse;
import lombok.RequiredArgsConstructor;

// Síndico do condomínio OU dono do apartamento (regra aplicada no serviço).
@RestController
@RequestMapping("/api/apartamentos/{apartamentoId}/alertas")
@RequiredArgsConstructor
public class AlertaController {

    private final AlertaService alertaService;

    @GetMapping
    public List<AlertaResponse> listar(@PathVariable UUID apartamentoId) {
        return alertaService.listarPorApartamento(apartamentoId);
    }

}
