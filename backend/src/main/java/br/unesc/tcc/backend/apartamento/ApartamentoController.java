package br.unesc.tcc.backend.apartamento;

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

import br.unesc.tcc.backend.apartamento.dto.ApartamentoRequest;
import br.unesc.tcc.backend.apartamento.dto.ApartamentoResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/apartamentos")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SINDICO')")
public class ApartamentoController {

    private final ApartamentoService apartamentoService;

    @GetMapping
    public List<ApartamentoResponse> listar(@RequestParam UUID condominioId) {
        return apartamentoService.listarPorCondominio(condominioId);
    }

    @GetMapping("/{id}")
    public ApartamentoResponse buscar(@PathVariable UUID id) {
        return apartamentoService.buscar(id);
    }

    @PostMapping
    public ResponseEntity<ApartamentoResponse> criar(@Valid @RequestBody ApartamentoRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(apartamentoService.criar(request));
    }

    @PutMapping("/{id}")
    public ApartamentoResponse atualizar(@PathVariable UUID id, @Valid @RequestBody ApartamentoRequest request) {
        return apartamentoService.atualizar(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable UUID id) {
        apartamentoService.excluir(id);
        return ResponseEntity.noContent().build();
    }

}
