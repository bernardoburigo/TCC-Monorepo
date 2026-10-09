package br.unesc.tcc.backend.leitura;

import java.time.Instant;
import java.util.UUID;

public interface UltimaLeituraProjection {

    UUID getSensorId();

    // quando o backend RECEBEU (base do status ONLINE/OFFLINE)
    Instant getRecebidoEm();

    // quando o ESP32 mediu (fim da janela)
    Instant getTimestampLeitura();

}
