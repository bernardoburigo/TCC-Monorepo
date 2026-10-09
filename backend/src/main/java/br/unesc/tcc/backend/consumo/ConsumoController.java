package br.unesc.tcc.backend.consumo;

import java.time.Instant;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import br.unesc.tcc.backend.consumo.dto.ConsumoApartamentoResponse;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/apartamentos/{id}/consumo")
@RequiredArgsConstructor
public class ConsumoController {

    private final ConsumoService consumoService;

    @GetMapping
    public ConsumoApartamentoResponse consultar(
            @PathVariable UUID id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant inicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant fim,
            @RequestParam(required = false) Granularidade granularidade) {
        return consumoService.consultar(id, inicio, fim, granularidade);
    }

}
