package br.unesc.tcc.backend.painel;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import br.unesc.tcc.backend.painel.dto.ApartamentoPainelResponse;
import br.unesc.tcc.backend.security.AutenticacaoUtil;
import br.unesc.tcc.backend.usuario.dto.UsuarioResponse;
import lombok.RequiredArgsConstructor;

// Endpoints do app (Sprint 4) para QUALQUER usuário autenticado: sem o @PreAuthorize de
// SINDICO dos controllers de CRUD, senão o PROPRIETARIO não conseguiria ver nada.
@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class PainelController {

    private final PainelService painelService;

    @GetMapping
    public UsuarioResponse me() {
        return UsuarioResponse.de(AutenticacaoUtil.usuarioAutenticado());
    }

    @GetMapping("/apartamentos")
    public List<ApartamentoPainelResponse> meusApartamentos() {
        return painelService.listarMeusApartamentos();
    }

}
