package br.unesc.tcc.backend.condominio;

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
import org.springframework.web.bind.annotation.RestController;

import br.unesc.tcc.backend.condominio.dto.CondominioRequest;
import br.unesc.tcc.backend.condominio.dto.CondominioResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/condominios")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SINDICO')")
public class CondominioController {

    private final CondominioService condominioService;

    @GetMapping
    public List<CondominioResponse> listar() {
        return condominioService.listarMeus();
    }

    @GetMapping("/{id}")
    public CondominioResponse buscar(@PathVariable UUID id) {
        return condominioService.buscar(id);
    }

    @PostMapping
    public ResponseEntity<CondominioResponse> criar(@Valid @RequestBody CondominioRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(condominioService.criar(request));
    }

    @PutMapping("/{id}")
    public CondominioResponse atualizar(@PathVariable UUID id, @Valid @RequestBody CondominioRequest request) {
        return condominioService.atualizar(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable UUID id) {
        condominioService.excluir(id);
        return ResponseEntity.noContent().build();
    }

}
