package br.unesc.tcc.backend.sensor;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SensorRepository extends JpaRepository<Sensor, UUID> {

    Optional<Sensor> findByToken(String token);

    List<Sensor> findByApartamentoIdAndAtivoTrue(UUID apartamentoId);

    List<Sensor> findByApartamentoIdInAndAtivoTrue(Collection<UUID> apartamentoIds);

}
