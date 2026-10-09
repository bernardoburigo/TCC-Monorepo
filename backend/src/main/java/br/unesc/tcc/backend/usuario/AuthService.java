package br.unesc.tcc.backend.usuario;

import java.util.List;
import java.util.Objects;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.unesc.tcc.backend.apartamento.Apartamento;
import br.unesc.tcc.backend.apartamento.ApartamentoRepository;
import br.unesc.tcc.backend.common.ConflitoException;
import br.unesc.tcc.backend.common.EntidadeNaoEncontradaException;
import br.unesc.tcc.backend.condominio.Condominio;
import br.unesc.tcc.backend.condominio.CondominioRepository;
import br.unesc.tcc.backend.security.JwtService;
import br.unesc.tcc.backend.usuario.dto.LoginRequest;
import br.unesc.tcc.backend.usuario.dto.LoginResponse;
import br.unesc.tcc.backend.usuario.dto.RegistroRequest;
import br.unesc.tcc.backend.usuario.dto.UsuarioResponse;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final CondominioRepository condominioRepository;
    private final ApartamentoRepository apartamentoRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    @Transactional
    public UsuarioResponse registrar(RegistroRequest request) {
        if (usuarioRepository.existsByEmail(request.email())) {
            throw new ConflitoException("Já existe um usuário cadastrado com este e-mail");
        }

        Usuario usuario = Usuario.builder()
                .nome(request.nome())
                .email(request.email())
                .senhaHash(passwordEncoder.encode(request.senha()))
                .role(request.role())
                .build();
        usuario = usuarioRepository.save(usuario);

        switch (request.role()) {
            case SINDICO -> criarCondominioParaSindico(usuario, request.nomeCondominio());
            case PROPRIETARIO -> vincularApartamentos(usuario, request.apartamentoIds());
        }

        return UsuarioResponse.de(usuario);
    }

    private void criarCondominioParaSindico(Usuario sindico, String nomeCondominio) {
        if (nomeCondominio == null || nomeCondominio.isBlank()) {
            throw new IllegalArgumentException("nomeCondominio é obrigatório para o papel SINDICO");
        }

        Condominio condominio = Condominio.builder()
                .nome(nomeCondominio)
                .sindico(sindico)
                .build();
        condominioRepository.save(condominio);
    }

    private void vincularApartamentos(Usuario proprietario, List<java.util.UUID> apartamentoIds) {
        if (apartamentoIds == null || apartamentoIds.isEmpty()) {
            throw new IllegalArgumentException("apartamentoIds é obrigatório para o papel PROPRIETARIO");
        }

        for (var apartamentoId : apartamentoIds) {
            Apartamento apartamento = apartamentoRepository.findById(apartamentoId)
                    .orElseThrow(() -> new EntidadeNaoEncontradaException("Apartamento não encontrado: " + apartamentoId));

            if (apartamento.getProprietario() != null && !Objects.equals(apartamento.getProprietario().getId(), proprietario.getId())) {
                throw new ConflitoException("Apartamento " + apartamentoId + " já possui outro proprietário");
            }

            apartamento.setProprietario(proprietario);
            apartamentoRepository.save(apartamento);
        }
    }

    public LoginResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.senha()));

        Usuario usuario = usuarioRepository.findByEmail(request.email())
                .orElseThrow(() -> new EntidadeNaoEncontradaException("Usuário não encontrado"));

        String token = jwtService.gerarToken(usuario);
        return new LoginResponse(token, usuario.getNome(), usuario.getRole());
    }

}
