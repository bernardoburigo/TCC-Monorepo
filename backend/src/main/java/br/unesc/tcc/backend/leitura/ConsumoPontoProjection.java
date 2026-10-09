package br.unesc.tcc.backend.leitura;

import java.time.Instant;

public interface ConsumoPontoProjection {

    Instant getPeriodo();

    Double getVolumeTotalMl();

}
