package br.unesc.tcc.backend.condominio;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CondominioRepository extends JpaRepository<Condominio, UUID> {

    List<Condominio> findBySindicoIdAndAtivoTrue(UUID sindicoId);

}
