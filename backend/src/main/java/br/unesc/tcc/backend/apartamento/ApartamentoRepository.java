package br.unesc.tcc.backend.apartamento;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ApartamentoRepository extends JpaRepository<Apartamento, UUID> {

    List<Apartamento> findByCondominioIdAndAtivoTrue(UUID condominioId);

    List<Apartamento> findByCondominioIdInAndAtivoTrue(List<UUID> condominioIds);

    // JOIN FETCH do condomínio: o painel precisa do nome dele em cada linha, e sem isso
    // seriam N consultas LAZY.
    @Query("""
            SELECT a FROM Apartamento a JOIN FETCH a.condominio c
            WHERE c.id IN :condominioIds AND a.ativo = TRUE
            """)
    List<Apartamento> findAtivosComCondominioPorCondominios(@Param("condominioIds") Collection<UUID> condominioIds);

    @Query("""
            SELECT a FROM Apartamento a JOIN FETCH a.condominio c
            WHERE a.proprietario.id = :usuarioId AND a.ativo = TRUE AND c.ativo = TRUE
            """)
    List<Apartamento> findAtivosComCondominioDoProprietario(@Param("usuarioId") UUID usuarioId);

}
